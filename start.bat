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
  echo Einmalige Einrichtung: Playwright-Abhaengigkeiten werden installiert ...
  call npx playwright install chromium
  if errorlevel 1 goto :error
  type nul > ".setup-complete"
)

set "DEBUG_URL=http://127.0.0.1:9222/json/version"
set "ACCOUNT_URL=https://www.lotto-niedersachsen.de/spielkonto/meine-spiele"

powershell -NoProfile -Command "try { Invoke-RestMethod '%DEBUG_URL%' | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto :runbot

set "BROWSER_BIN=%BINGO_BROWSER%"
if not defined BROWSER_BIN if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_BIN=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_BIN if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_BIN=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_BIN if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_BIN if exist "%ProgramFiles%\Chromium\Application\chrome.exe" set "BROWSER_BIN=%ProgramFiles%\Chromium\Application\chrome.exe"

if not defined BROWSER_BIN (
  echo Chrome wurde nicht gefunden.
  echo Installiere Google Chrome oder setze BINGO_BROWSER auf den Pfad zu chrome.exe.
  goto :error
)

echo Starte Chrome mit lokalem Remote-Debugging auf Port 9222 ...
start "" "%BROWSER_BIN%" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="%CD%\.browser-profile" --no-first-run --no-default-browser-check "%ACCOUNT_URL%"

for /l %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { Invoke-RestMethod '%DEBUG_URL%' | Out-Null; exit 0 } catch { exit 1 }"
  if not errorlevel 1 goto :runbot
  timeout /t 1 /nobreak >nul
)

echo Der Debug-Browser konnte Port 9222 nicht oeffnen.
goto :error

:runbot
call npm start
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo Der Start ist fehlgeschlagen. Bitte Fehlermeldung oben pruefen.
pause
exit /b 1
