@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Atlassian Statuspage Discord Bot Test
echo ========================================
echo.

REM Check if curl is available
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: curl command not found!
    echo Please install curl or use Windows 10/11 which includes curl by default.
    pause
    exit /b 1
)

:menu
echo.
echo Select test type:
echo 1. Empty payload (Connection test)
echo 2. Component update (Operational)
echo 3. Component update (Partial outage)
echo 4. Incident create (Major outage)
echo 5. Incident resolved
echo 0. Exit
echo.

set /p choice="Select (0-5): "

if "%choice%"=="0" goto end
if "%choice%"=="1" goto test_empty
if "%choice%"=="2" goto test_operational
if "%choice%"=="3" goto test_partial
if "%choice%"=="4" goto test_incident
if "%choice%"=="5" goto test_resolved

echo Invalid selection.
goto menu

:test_empty
echo.
echo ----------------------------------------
echo Test: Empty Payload
echo ----------------------------------------
echo Sending empty payload...
echo.
curl -X POST http://localhost:5001/atlassianstatuspagediscordbot/us-central1/statuspageWebhook ^
  -H "Content-Type: application/json" ^
  -d "{}"
echo.
echo.
echo Test completed! Check your Discord channel.
echo ----------------------------------------
pause
goto menu

:test_operational
echo.
echo ----------------------------------------
echo Test: Component Operational
echo ----------------------------------------
echo Service: API Gateway
echo Status: Operational (Recovery)
echo.
curl -X POST http://localhost:5001/atlassianstatuspagediscordbot/us-central1/statuspageWebhook ^
  -H "Content-Type: application/json" ^
  -d "{\"data\":{\"component\":{\"name\":\"API Gateway\",\"status\":\"operational\"},\"component_update\":{\"old_status\":\"partial_outage\"},\"page\":{\"name\":\"Example Service\",\"url\":\"https://status.example.com\"}},\"timestamp\":\"2024-01-01T12:00:00Z\"}"
echo.
echo.
echo Test completed! Check your Discord channel.
echo ----------------------------------------
pause
goto menu

:test_partial
echo.
echo ----------------------------------------
echo Test: Partial Outage
echo ----------------------------------------
echo Service: Database Cluster
echo Status: Partial Outage
echo.
curl -X POST http://localhost:5001/atlassianstatuspagediscordbot/us-central1/statuspageWebhook ^
  -H "Content-Type: application/json" ^
  -d "{\"data\":{\"component\":{\"name\":\"Database Cluster\",\"status\":\"partial_outage\"},\"component_update\":{\"old_status\":\"operational\"},\"page\":{\"name\":\"Cloud Platform Status\",\"url\":\"https://status.cloudplatform.com\"}},\"timestamp\":\"2024-01-01T12:00:00Z\"}"
echo.
echo.
echo Test completed! Check your Discord channel.
echo ----------------------------------------
pause
goto menu

:test_incident
echo.
echo ----------------------------------------
echo Test: Major Incident
echo ----------------------------------------
echo Incident: Major Database Outage
echo Status: Investigating
echo.
curl -X POST http://localhost:5001/atlassianstatuspagediscordbot/us-central1/statuspageWebhook ^
  -H "Content-Type: application/json" ^
  -d "{\"data\":{\"incident\":{\"name\":\"Major Database Outage\",\"status\":\"investigating\",\"impact\":\"major\"},\"page\":{\"name\":\"Production Systems\",\"url\":\"https://status.production.com\"}},\"timestamp\":\"2024-01-01T12:00:00Z\"}"
echo.
echo.
echo Test completed! Check your Discord channel.
echo ----------------------------------------
pause
goto menu

:test_resolved
echo.
echo ----------------------------------------
echo Test: Incident Resolved
echo ----------------------------------------
echo Incident: Network Issues Resolved
echo Status: Resolved
echo.
curl -X POST http://localhost:5001/atlassianstatuspagediscordbot/us-central1/statuspageWebhook ^
  -H "Content-Type: application/json" ^
  -d "{\"data\":{\"incident\":{\"name\":\"Network Issues Resolved\",\"status\":\"resolved\",\"impact\":\"minor\"},\"page\":{\"name\":\"Network Services\",\"url\":\"https://status.network.com\"}},\"timestamp\":\"2024-01-01T12:00:00Z\"}"
echo.
echo.
echo Test completed! Check your Discord channel.
echo ----------------------------------------
pause
goto menu

:end
echo.
echo Exiting test script.
exit /b 0