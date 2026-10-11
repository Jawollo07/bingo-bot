@echo off
setlocal
cd /d "%~dp0"

set "NODE_BIN=%~dp0runtime\node.exe"
if not exist "%NODE_BIN%" (
  echo Die mitgelieferte Node.js-Laufzeit wurde nicht gefunden.
  pause
  exit /b 1
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
  echo Google Chrome wurde nicht gefunden.
  echo Bitte installiere Chrome oder setze BINGO_BROWSER auf den Pfad zu chrome.exe.
  goto :error
)

if not exist "%LOCALAPPDATA%\Bingo-Bot" mkdir "%LOCALAPPDATA%\Bingo-Bot"
if not exist "%LOCALAPPDATA%\Bingo-Bot\browser-profile" mkdir "%LOCALAPPDATA%\Bingo-Bot\browser-profile"

echo Starte Chrome mit lokalem Remote-Debugging auf Port 9222 ...
start "Bingo Bot - Chrome" "%BROWSER_BIN%" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Bingo-Bot\browser-profile" --no-first-run --no-default-browser-check "%ACCOUNT_URL%"

for /l %%i in (1,1,30) do (
  powershell -NoProfile -Command "try { Invoke-RestMethod '%DEBUG_URL%' | Out-Null; exit 0 } catch { exit 1 }"
  if not errorlevel 1 goto :runbot
  timeout /t 1 /nobreak >nul
)

echo Der Debug-Browser konnte Port 9222 nicht oeffnen.
goto :error

:runbot
"%NODE_BIN%" "%~dp0index.js"
set "BOT_EXIT=%ERRORLEVEL%"
echo.
if not "%BOT_EXIT%"=="0" echo Der Bot wurde mit Status %BOT_EXIT% beendet.
pause
exit /b %BOT_EXIT%

:error
echo.
echo Der Start ist fehlgeschlagen. Bitte Fehlermeldung oben pruefen.
pause
exit /b 1
