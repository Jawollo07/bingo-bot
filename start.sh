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
  echo "Einmalige Einrichtung: Chromium wird installiert …"
  npx playwright install chromium
  touch .setup-complete
fi

npm start
