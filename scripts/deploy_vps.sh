#!/usr/bin/env bash
set -euo pipefail

DEFAULT_APP_DIR="/var/www/ar-bbn"
DEFAULT_SERVICE_NAME="ar-bbn-api"

read -r -p "Masukkan path project [${DEFAULT_APP_DIR}]: " APP_DIR
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
read -r -p "Nama service systemd [${DEFAULT_SERVICE_NAME}]: " SERVICE_NAME
SERVICE_NAME="${SERVICE_NAME:-$DEFAULT_SERVICE_NAME}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "App directory not found: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

git pull

# Backend deps (safe to re-run)
source venv/bin/activate
pip install -r backend/requirements.txt

# Frontend build
cd "$APP_DIR/frontend"
if [[ ! -f .env ]]; then
  echo "Missing frontend/.env. Create it with VITE_API_BASE." >&2
  exit 1
fi
npm install
npm run build

# Restart API
systemctl restart "$SERVICE_NAME"

echo "Deploy complete."
