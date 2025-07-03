# Atlassian Statuspage Discord Bot

## 概要
Atlassian StatuspageのWebhookイベントを受信し、ChatGPT APIを使用してメッセージを解釈し、Discord上に分かりやすい形式で通知を投稿するボットシステム。Firebase Functionsを使用してサーバーレス環境で動作します。

## 機能
- 任意のAtlassian Statuspageサービスからwebhookを受信
- ChatGPT APIを使用して自然な日本語メッセージを生成
- Discord Webhookを通じてリアルタイム通知
- フォールバック機能（ChatGPT API失敗時も基本的なメッセージを生成）

## システム構成

### 技術スタック
- **実行環境**: Firebase Functions (Node.js)
- **Webhook受信**: Atlassian Statuspage Webhooks
- **通知先**: Discord (Webhook)
- **メッセージ生成**: OpenAI ChatGPT API
- **言語**: JavaScript

### アーキテクチャ概要
```
Atlassian Statuspage → Webhook → Firebase Functions → ChatGPT API → Discord Channel
```

## 前提条件

1. **Firebase プロジェクト**
   - Firebaseアカウントとプロジェクト
   - Firebase CLIがインストール済み

2. **Discord Webhook URL**
   - 通知を送信したいDiscordチャンネルのWebhook URL

3. **OpenAI API Key**
   - ChatGPT APIを使用するためのAPIキー

## セットアップ手順

### 1. Firebase CLIのインストール
```bash
npm install -g firebase-tools
```

### 2. Firebase ログイン
```bash
firebase login
```

### 3. プロジェクトのクローン
```bash
git clone [repository-url]
cd AtlassianStatuspageDiscordBot
```

### 4. Firebaseプロジェクトの設定
```bash
# Firebaseプロジェクトを設定
firebase use --add
# プロンプトでプロジェクトを選択し、エイリアス名を入力（例: default）
```

### 5. 依存関係のインストール
```bash
cd functions
npm install
cd ..
```

### 6. シークレットの設定

Firebase Functions Secret Managerを使用してAPIキーを安全に管理します：

```bash
# Discord Webhook URLの設定
firebase functions:secrets:set DISCORD_WEBHOOK_URL
# プロンプトが表示されたら、Discord Webhook URLを入力

# OpenAI API Keyの設定
firebase functions:secrets:set OPENAI_API_KEY
# プロンプトが表示されたら、ChatGPT APIキーを入力
```

### 7. デプロイ

```bash
# Node.js v20を使用（nvm利用の場合）
nvm use 20

# デプロイスクリプトを使用
deploy-functions.bat

# または直接デプロイ
firebase deploy --only functions
```

デプロイが成功すると、Firebase Functionsのエンドポイント URLが表示されます：
```
https://[REGION]-[PROJECT-ID].cloudfunctions.net/statuspageWebhook
```

### 8. Atlassian Statuspageの設定

1. Statuspageの管理画面にログイン
2. "Notifications" → "Webhook notifications" に移動
3. "Add endpoint" をクリック
4. Firebase FunctionsのURL を入力
5. 通知したいイベントタイプを選択：
   - Component updates
   - Incident updates
   - Maintenance updates
6. 保存

## 動作確認

### ローカルでのテスト

エミュレーターを使用したローカルテスト：

```bash
# エミュレーターの起動（Windows）
start-emulator.bat

# 別のターミナルでテストを実行
test-webhook-for-emulator.bat
```

### 本番環境でのテスト

```bash
# Windows
test-webhook.bat
```

## Webhook イベントタイプ

Statuspageは以下のイベントで通知を送信します：

1. **incident.create** - 新規インシデント作成時
2. **incident.update** - インシデント更新時
3. **incident.resolve** - インシデント解決時
4. **component.update** - コンポーネントステータス変更時
5. **page.update** - ステータスページ全体の更新時

## Discord通知フォーマット

### ステータスと絵文字の対応
- ✅ **Operational** - 正常稼働
- 🟡 **Partial Outage** - 部分的障害
- 🔴 **Major Outage** - 重大障害
- 🔧 **Under Maintenance** - メンテナンス中
- 🟠 **Degraded Performance** - パフォーマンス低下

### 通知メッセージ例
```
⚠️ **Production System Status Update**
```
Service: API Gateway
New Status: 🟡 Partial Outage
Previous Status: ✅ Operational

API Gatewayに部分的な障害が発生しています。一部のAPIエンドポイントで接続エラーが発生する可能性があります。
```
[View Details](https://status.example.com)
```

## プロジェクト構造
```
/
├── functions/
│   ├── index.js           # メインエントリポイント
│   ├── package.json       # 依存関係
│   └── .gitignore
├── firebase.json          # Firebaseプロジェクト設定
├── .firebaserc           # Firebaseプロジェクト設定
├── README.md             # このファイル
├── deploy-functions.bat      # デプロイ用スクリプト
├── deploy-functions-simple.bat  # シンプルなデプロイ用スクリプト
├── start-emulator.bat     # エミュレーター起動スクリプト
├── test-webhook-for-emulator.bat  # エミュレーター用テストスクリプト
└── test-webhook.bat      # 本番環境テストスクリプト
```

## カスタマイズ

### メッセージフォーマット
`functions/index.js`の`formatStatusMessage`関数を編集することで、Discordメッセージのフォーマットをカスタマイズできます。

### ステータス絵文字のカスタマイズ
`formatStatus`関数内の`statusMap`オブジェクトを編集することで、ステータスに対応する絵文字を変更できます。

## セキュリティ

- APIキーは必ずFirebase Secret Managerを使用して管理してください
- 直接コードにハードコーディングしないでください
- `.gitignore`ファイルで環境設定ファイルが除外されていることを確認してください
- Firebase FunctionsのエンドポイントはHTTPSで保護されています

## ライセンス
このプロジェクトはMITライセンスの下で公開されています。
