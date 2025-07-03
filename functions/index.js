const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const https = require('https');
const { URL } = require('url');
const { defineSecret } = require('firebase-functions/params');

// シークレットを定義
const discordWebhookUrl = defineSecret('DISCORD_WEBHOOK_URL');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

/**
 * ChatGPTで要約文章のみを生成
 */
async function getSummaryFromChatGPT(payload, apiKey) {
  return new Promise((resolve, reject) => {
    try {
      logger.info('Starting ChatGPT API call for summary...');
      
      const prompt = `
以下はステータスページからのWebhookペイロードです。
このペイロードの内容を日本語で簡潔に要約してください（100文字以内）。

要点：
- 何のサービスに何が起きたか
- 現在の状況
- ユーザーへの影響

ペイロード:
${JSON.stringify(payload, null, 2)}

簡潔な要約文章のみを返してください（JSON形式や説明は不要）:
      `;

      const requestData = JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'あなたはサービスのステータス情報を簡潔に要約する専門家です。100文字以内の分かりやすい日本語で要約してください。'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      });

      logger.info('Request data length:', requestData.length);

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            logger.info('OpenAI raw response:', data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const response = JSON.parse(data);
              const summary = response.choices[0].message.content.trim();
              logger.info('ChatGPT summary success:', summary);
              resolve(summary);
            } else {
              logger.error(`OpenAI API error: ${res.statusCode}`, data);
              reject(new Error(`OpenAI API error: ${res.statusCode}`));
            }
          } catch (parseError) {
            logger.error('Failed to parse OpenAI response:', parseError, 'Raw data:', data);
            reject(parseError);
          }
        });
      });

      req.on('error', (error) => {
        logger.error('HTTPS request error:', error);
        reject(error);
      });

      req.setTimeout(30000);
      req.write(requestData);
      req.end();
      
    } catch (error) {
      logger.error('Error in getSummaryFromChatGPT:', error);
      reject(error);
    }
  });
}

/**
 * JavaScript側でペイロードからステータス情報を抽出
 */
function extractStatusInfo(payload) {
  try {
    const data = payload.data || payload;
    const component = data.component || {};
    const componentUpdate = data.component_update || {};
    const incident = data.incident || {};
    const page = data.page || {};
    
    // ステータスを絵文字付きフォーマットに変換
    const formatStatus = (status) => {
      const statusMap = {
        'operational': '✅ Operational',
        'partial_outage': '🟡 Partial Outage', 
        'major_outage': '🔴 Major Outage',
        'under_maintenance': '🔧 Under Maintenance',
        'degraded_performance': '🟠 Degraded Performance'
      };
      return statusMap[status] || `❓ ${status}`;
    };
    
    const statusInfo = {
      serviceName: component.name || incident.name || 'Unknown Service',
      newStatus: formatStatus(component.status || 'unknown'),
      oldStatus: formatStatus(componentUpdate.old_status || 'unknown'),
      pageStatus: page.status_description || 'Unknown',
      eventType: incident.name ? 'incident' : 'component_update',
      timestamp: payload.timestamp || new Date().toISOString(),
      // 汎用化のために追加
      pageName: page.name || 'Unknown Service',
      pageUrl: page.url || '#',
      incidentImpact: incident.impact || 'none',
      incidentStatus: incident.status || 'unknown'
    };
    
    logger.info('Extracted status info:', statusInfo);
    return statusInfo;
    
  } catch (error) {
    logger.error('Error extracting status info:', error);
    return {
      serviceName: 'Unknown Service',
      newStatus: '❓ Unknown',
      oldStatus: '❓ Unknown', 
      pageStatus: 'Unknown',
      eventType: 'unknown',
      timestamp: new Date().toISOString(),
      pageName: 'Unknown Service',
      pageUrl: '#',
      incidentImpact: 'none',
      incidentStatus: 'unknown'
    };
  }
}

/**
 * ChatGPT失敗時のフォールバック要約
 */
function generateFallbackSummary(statusInfo) {
  // サービス名を取得（コンポーネント名またはページ名）
  const serviceName = statusInfo.serviceName || statusInfo.pageName || 'サービス';
  
  if (statusInfo.newStatus.includes('Operational')) {
    return `${serviceName}が正常に復旧しました。`;
  } else if (statusInfo.newStatus.includes('Partial Outage')) {
    return `${serviceName}に部分的な障害が発生しています。`;
  } else if (statusInfo.newStatus.includes('Major Outage')) {
    return `${serviceName}に重大な障害が発生しています。`;
  } else if (statusInfo.newStatus.includes('Under Maintenance')) {
    return `${serviceName}がメンテナンス中です。`;
  } else if (statusInfo.newStatus.includes('Degraded Performance')) {
    return `${serviceName}のパフォーマンスが低下しています。`;
  } else {
    return `${serviceName}のステータスが更新されました。`;
  }
}

/**
 * 最終的なDiscordメッセージを組み立て
 */
function formatStatusMessage(statusInfo, summary) {
  try {
    const message = `⚠️ **${statusInfo.pageName} Status Update**
\`\`\`
Service: ${statusInfo.serviceName}
New Status: ${statusInfo.newStatus}
Previous Status: ${statusInfo.oldStatus}

${summary}
\`\`\`
[View Details](${statusInfo.pageUrl})`;

    logger.info('Formatted status message');
    return message;
    
  } catch (error) {
    logger.error('Error formatting status message:', error);
    return `⚠️ **Service Status Update**
\`\`\`
Error formatting message
\`\`\`
[View Details](${statusInfo.pageUrl || '#'})`;
  }
}

exports.statuspageWebhook = onRequest(
  {
    secrets: [discordWebhookUrl, openaiApiKey]
  },
  async (req, res) => {
    try {
      logger.info('Webhook received!', { method: req.method });

      // GETリクエストの場合は、Discordに投稿せずに情報を返す
      if (req.method === 'GET') {
        logger.info('GET request received - returning info without posting');
        return res.status(200).json({ 
          message: 'Atlassian Statuspage Discord Bot Webhook Endpoint',
          status: 'active',
          description: 'This endpoint receives webhooks from Atlassian Statuspage and posts to Discord',
          method: 'POST required for webhook processing'
        });
      }

      // POSTリクエスト以外は拒否
      if (req.method !== 'POST') {
        logger.warn(`Unsupported method: ${req.method}`);
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // シークレットから値を取得
      const webhookUrl = discordWebhookUrl.value();
      const apiKey = openaiApiKey.value();
      
      if (!webhookUrl) {
        logger.error('DISCORD_WEBHOOK_URL is not set');
        return res.status(500).json({ error: 'Discord webhook URL is not configured' });
      }
      
      if (!apiKey) {
        logger.error('OPENAI_API_KEY is not set');
        return res.status(500).json({ error: 'OpenAI API key is not configured' });
      }

      // ペイロードを取得
      const payload = req.body;
      logger.info('Received payload:', JSON.stringify(payload, null, 2));

      // 空のペイロードまたは無効なペイロードの場合は、Discordに投稿せずに終了
      if (!payload || Object.keys(payload).length === 0) {
        logger.info('Empty or invalid payload received - skipping Discord post');
        return res.status(200).json({ 
          success: true, 
          message: 'Empty payload received - no action taken' 
        });
      }

      let message;
      let statusInfo = {};
      
      logger.info('Processing payload...');
      
      // JavaScript側でステータス情報を抽出
      statusInfo = extractStatusInfo(payload);
      
      try {
        // ChatGPTで要約文章を生成
        logger.info('Getting summary from ChatGPT...');
        const summary = await getSummaryFromChatGPT(payload, apiKey);
        
        // Discord用メッセージを組み立て
        message = formatStatusMessage(statusInfo, summary);
      } catch (chatGptError) {
        logger.error('ChatGPT API failed, using fallback summary:', chatGptError);
        // ChatGPT失敗時はシンプルな要約
        const fallbackSummary = generateFallbackSummary(statusInfo);
        message = formatStatusMessage(statusInfo, fallbackSummary);
      }

      // Discordに投稿（statusInfoを渡す）
      await postToDiscord(message, webhookUrl, statusInfo);
      
      logger.info('Successfully posted to Discord');
      return res.status(200).json({ success: true, message: 'Posted to Discord successfully' });

    } catch (error) {
      logger.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * ChatGPTでペイロードを解釈してDiscord用のメッセージを生成
 */
async function interpretWithChatGPT(payload, apiKey) {
  return new Promise((resolve, reject) => {
    try {
      logger.info('Starting ChatGPT API call...');
      
      const prompt = `
以下はVRChatのステータスページ（statuspage.io）からのWebhookペイロードです。
このペイロードの内容を解釈して、Discord投稿用の日本語メッセージを作成してください。

要件：
1. サービス名: VRChat
2. ステータス変更の内容を分かりやすく説明
3. 影響を受ける機能やサービスを明記
4. 時刻情報があれば含める（日本時間で表示）
5. 絵文字を適切に使用して見やすくする
6. 200文字以内で簡潔にまとめる
7. 重要度に応じて適切な絵文字を使用（🔴障害、🟡部分障害、🔧メンテナンス、✅復旧など）

ペイロード:
${JSON.stringify(payload, null, 2)}

Discord投稿用メッセージのみを返してください（他の説明は不要）:
      `;

      const requestData = JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'あなたはVRChatのステータス情報をDiscord用にフォーマットする専門家です。簡潔で分かりやすい日本語メッセージを作成してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      logger.info('Request data length:', requestData.length);

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      logger.info('Making HTTPS request to OpenAI...');

      const req = https.request(options, (res) => {
        let data = '';
        
        logger.info('OpenAI response status:', res.statusCode);
        logger.info('OpenAI response headers:', res.headers);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            logger.info('OpenAI raw response:', data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const response = JSON.parse(data);
              const message = response.choices[0].message.content.trim();
              logger.info('ChatGPT response success:', message);
              resolve(message);
            } else {
              logger.error(`OpenAI API error: ${res.statusCode}`, data);
              reject(new Error(`OpenAI API error: ${res.statusCode} - ${data}`));
            }
          } catch (parseError) {
            logger.error('Failed to parse OpenAI response:', parseError, 'Raw data:', data);
            reject(parseError);
          }
        });
      });

      req.on('error', (error) => {
        logger.error('HTTPS request error:', error);
        reject(error);
      });

      req.on('timeout', () => {
        logger.error('OpenAI API request timeout');
        req.destroy();
        reject(new Error('OpenAI API timeout'));
      });

      // 30秒でタイムアウト
      req.setTimeout(30000);

      logger.info('Writing request data...');
      req.write(requestData);
      req.end();
      logger.info('Request sent to OpenAI');
      
    } catch (error) {
      logger.error('Error in interpretWithChatGPT setup:', error);
      reject(error);
    }
  });
}

/**
 * Discordにメッセージを投稿
 */
async function postToDiscord(message, webhookUrl, statusInfo = {}) {
  return new Promise((resolve, reject) => {
    try {
      // statusInfoからサービス名を取得
      const serviceName = statusInfo?.pageName || 'Status Update';
      
      const discordPayload = JSON.stringify({
        content: message,
        username: serviceName
      });

      const url = new URL(webhookUrl);
      
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(discordPayload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.info('Successfully posted to Discord');
            resolve(data);
          } else {
            logger.error(`Discord API error: ${res.statusCode}`);
            reject(new Error(`Discord API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Error posting to Discord:', error);
        reject(error);
      });

      req.write(discordPayload);
      req.end();
      
    } catch (error) {
      logger.error('Error posting to Discord:', error);
      reject(error);
    }
  });
}