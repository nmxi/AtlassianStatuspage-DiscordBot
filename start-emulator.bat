@echo off
echo ==========================================
echo Firebase Emulator Start Script (Simple)
echo ==========================================
echo.
echo IMPORTANT: Make sure you have already run:
echo   nvm use 20
echo.
pause

cd functions

echo Starting Firebase Emulator...
firebase emulators:start --only functions