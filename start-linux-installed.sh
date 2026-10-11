#!/usr/bin/env bash
set -euo pipefail

APP_PATH="$(readlink -f -- "${BASH_SOURCE[0]}")"
APP_DIR="$(cd -- "$(dirname -- "$APP_PATH")" && pwd)"
if [[ "$(basename "$APP_DIR")" == "bin" && -f "$APP_DIR/../index.js" ]]; then
  APP_DIR="$(cd -- "$APP_DIR/.." && pwd)"
fi
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/bingo-bot"
mkdir -p "$DATA_DIR/browser-profile" "$DATA_DIR/downloads"
export BINGO_DATA_DIR="$DATA_DIR/downloads"

NODE_BIN="$APP_DIR/runtime/node"
if [[ ! -x "$NODE_BIN" ]]; then
  echo "Die mitgelieferte Node.js-Laufzeit fehlt oder ist nicht ausführbar: $NODE_BIN"
  read -r -p "Enter zum Beenden ..."
  exit 1
fi

DEBUG_URL="http://127.0.0.1:9222/json/version"
ACCOUNT_URL="https://www.lotto-niedersachsen.de/spielkonto/meine-spiele"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl fehlt. Bitte installiere curl über deinen Paketmanager."
  read -r -p "Enter zum Beenden ..."
  exit 1
fi

if ! curl --silent --fail "$DEBUG_URL" >/dev/null; then
  BROWSER_BIN="${BINGO_BROWSER:-}"
  if [[ -z "$BROWSER_BIN" ]]; then
    for candidate in google-chrome google-chrome-stable chromium chromium-browser brave-browser; do
      if command -v "$candidate" >/dev/null 2>&1; then
        BROWSER_BIN="$(command -v "$candidate")"
        break
      fi
    done
  fi

  if [[ -z "$BROWSER_BIN" ]]; then
    echo "Chrome/Chromium wurde nicht gefunden."
    echo "Installiere Chromium oder setze BINGO_BROWSER=/pfad/zum/browser."
    read -r -p "Enter zum Beenden ..."
    exit 1
  fi

  echo "Starte Browser mit lokalem Remote-Debugging auf Port 9222 ..."
  "$BROWSER_BIN" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9222 \
    --user-data-dir="$DATA_DIR/browser-profile" \
    --no-first-run \
    --no-default-browser-check \
    "$ACCOUNT_URL" >"$DATA_DIR/browser.log" 2>&1 &

  for attempt in $(seq 1 30); do
    if curl --silent --fail "$DEBUG_URL" >/dev/null; then
      break
    fi
    sleep 1
  done
fi

if ! curl --silent --fail "$DEBUG_URL" >/dev/null; then
  echo "Der Debug-Browser konnte Port 9222 nicht öffnen."
  echo "Browser-Log: $DATA_DIR/browser.log"
  read -r -p "Enter zum Beenden ..."
  exit 1
fi

"$NODE_BIN" "$APP_DIR/index.js"
STATUS=$?
read -r -p "Enter zum Schließen ..."
exit "$STATUS"
