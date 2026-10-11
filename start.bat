@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js 22 LTS oder neuer installieren: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Erstinstallation: Pakete werden eingerichtet ...
  call npm install
  if errorlevel 1 goto :error
)

if not exist ".setup-complete" (
  echo Einmalige Einrichtung: Chromium wird installiert ...
  call npx playwright install chromium
  if errorlevel 1 goto :error
  type nul > ".setup-complete"
)

call npm start
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo Der Start ist fehlgeschlagen. Bitte Fehlermeldung oben pruefen.
pause
exit /b 1
