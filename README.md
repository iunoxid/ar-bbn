# Cari Piutang Web

Versi web untuk mencari kombinasi invoice dari file Excel berdasarkan nominal target dan toleransi.

## Struktur
- `backend/` FastAPI untuk upload, proses, dan download hasil
- `frontend/` React (Vite) untuk UI upload & hasil

## Backend (FastAPI)
1) Buat virtual env dan install dependencies:
```
python -m venv venv
venv\\Scripts\\activate
pip install -r backend\\requirements.txt
```

2) Jalankan API:
```
copy backend\\.env.example backend\\.env
python backend\\run_dev.py
```

## Frontend (React + Vite)
1) Install dependencies:
```
cd frontend
npm install
```

2) Set API base (opsional):
```
copy .env.example .env
```

3) Run dev server:
```
npm run dev
```

## API
- `POST /api/process` upload file + target(s) + tolerance
- `POST /api/upload` upload file, return `upload_id`
- `DELETE /api/upload/{upload_id}` delete uploaded file
- `GET /api/download/{file_name}` download hasil

## Catatan
- Batas upload default 10MB
- Cleanup otomatis file sementara tiap 1 jam (bisa diubah lewat `CLEANUP_TTL_SECONDS`)
- Interval cleanup bisa diubah lewat `CLEANUP_INTERVAL_SECONDS`
- Tema UI: neo-brutalist / modern brutalism (vibe bold seperti Saweria)

## Deploy di VPS Ubuntu (contoh Nginx + systemd)

### 1) Persiapan server
```
sudo apt update
sudo apt install -y python3-venv python3-pip nginx
```

### Automasi (opsional)
Lihat `deploy/DEPLOY.md` untuk script setup dan deploy otomatis.

### 2) Upload project ke server
Contoh lokasi: `/var/www/invoice-matcher`

### 3) Backend (FastAPI) sebagai service
```
cd /var/www/invoice-matcher
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

Buat file service:
```
sudo nano /etc/systemd/system/invoice-matcher-api.service
```
Isi:
```
[Unit]
Description=Invoice Matcher API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/invoice-matcher
EnvironmentFile=/var/www/invoice-matcher/backend/.env
ExecStart=/var/www/invoice-matcher/venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port ${PORT}
Restart=always

[Install]
WantedBy=multi-user.target
```

Aktifkan service:
```
sudo systemctl daemon-reload
sudo systemctl enable --now invoice-matcher-api
sudo systemctl status invoice-matcher-api
```

### 4) Build frontend
```
cd /var/www/invoice-matcher/frontend
npm install
echo "VITE_API_BASE=https://ar.bbn.biz.id" > .env
npm run build
```

### 5) Nginx config
```
sudo nano /etc/nginx/sites-available/invoice-matcher
```
Isi:
```
server {
    listen 80;
    server_name ar.bbn.biz.id;

    root /var/www/invoice-matcher/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Tambahkan server block untuk API subdomain:
```
server {
    listen 80;
    server_name api.ar.bbn.biz.id;

    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan Nginx:
```
sudo ln -s /etc/nginx/sites-available/invoice-matcher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6) (Opsional) HTTPS dengan Let's Encrypt
```
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ar.bbn.biz.id
```
