#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22 LTS oder neuer installieren: https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Erstinstallation: Pakete werden eingerichtet …"
  npm install
fi

if [ ! -f .setup-complete ]; then
  echo "Einmalige Einrichtung: Playwright-Abhängigkeiten werden installiert …"
  npx playwright install chromium
  touch .setup-complete
fi

DEBUG_URL="http://127.0.0.1:9222/json/version"
ACCOUNT_URL="https://www.lotto-niedersachsen.de/spielkonto/meine-spiele"

if ! curl --silent --fail "$DEBUG_URL" >/dev/null; then
  BROWSER_BIN="${BINGO_BROWSER:-}"
  if [ -z "$BROWSER_BIN" ]; then
    for candidate in google-chrome google-chrome-stable chromium chromium-browser brave-browser; do
      if command -v "$candidate" >/dev/null 2>&1; then
        BROWSER_BIN="$(command -v "$candidate")"
        break
      fi
    done
  fi

  if [ -z "$BROWSER_BIN" ]; then
    echo "Chrome/Chromium wurde nicht gefunden."
    echo "Installiere Chromium oder setze BINGO_BROWSER=/pfad/zum/browser."
    exit 1
  fi

  echo "Starte Browser mit lokalem Remote-Debugging auf Port 9222 …"
  "$BROWSER_BIN" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9222 \
    --user-data-dir="$PWD/.browser-profile" \
    --no-first-run \
    --no-default-browser-check \
    "$ACCOUNT_URL" >/tmp/bingo-bot-browser.log 2>&1 &

  for attempt in $(seq 1 30); do
    if curl --silent --fail "$DEBUG_URL" >/dev/null; then
      break
    fi
    sleep 1
  done
fi

if ! curl --silent --fail "$DEBUG_URL" >/dev/null; then
  echo "Der Debug-Browser konnte Port 9222 nicht öffnen."
  echo "Browser-Log: /tmp/bingo-bot-browser.log"
  exit 1
fi

npm start
