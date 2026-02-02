#!/usr/bin/env bash
set -euo pipefail

DEFAULT_APP_DIR="/var/www/ar-bbn"
DEFAULT_DOMAIN="ar.bbn.biz.id"
DEFAULT_API_DOMAIN="api.ar.bbn.biz.id"
DEFAULT_SERVICE_NAME="ar-bbn-api"

read -r -p "Masukkan path project [${DEFAULT_APP_DIR}]: " APP_DIR
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
read -r -p "Domain FE [${DEFAULT_DOMAIN}]: " DOMAIN
DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"
read -r -p "Domain API [${DEFAULT_API_DOMAIN}]: " API_DOMAIN
API_DOMAIN="${API_DOMAIN:-$DEFAULT_API_DOMAIN}"
read -r -p "Nama service systemd [${DEFAULT_SERVICE_NAME}]: " SERVICE_NAME
SERVICE_NAME="${SERVICE_NAME:-$DEFAULT_SERVICE_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (use sudo)." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "App directory not found: $APP_DIR" >&2
  exit 1
fi

apt update
apt install -y python3-venv python3-pip nginx

# Backend venv + deps
cd "$APP_DIR"
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Ensure .env exists
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
fi
PORT_VALUE=$(grep -E '^PORT=' backend/.env | tail -n 1 | cut -d '=' -f2 | tr -d '\r')
if [[ -z "$PORT_VALUE" ]]; then
  PORT_VALUE="9001"
fi

# Frontend build
cd "$APP_DIR/frontend"
npm install
if [[ ! -f .env ]]; then
  echo "VITE_API_BASE=https://$API_DOMAIN" > .env
fi
npm run build

# systemd service
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=AR BBN API
After=network.target

[Service]
User=www-data
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port \${PORT}
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

# nginx config
cat > "/etc/nginx/sites-available/${SERVICE_NAME}" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${APP_DIR}/frontend/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${PORT_VALUE};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

cat > "/etc/nginx/sites-available/${SERVICE_NAME}-api" <<EOF
server {
    listen 80;
    server_name ${API_DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT_VALUE};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}-api" "/etc/nginx/sites-enabled/${SERVICE_NAME}-api"
nginx -t
systemctl reload nginx

echo "Setup complete."
