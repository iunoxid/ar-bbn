# Deployment automation

## Setup (first time, run as root on VPS)
```
sudo bash scripts/setup_vps.sh
```

## Deploy updates (run on VPS)
```
sudo bash scripts/deploy_vps.sh
```

## What it does
- Setup installs python venv + nginx, builds frontend, creates systemd service
- Deploy pulls latest code, rebuilds frontend, restarts API service
- Nginx timeouts are increased for long processing (300s)
- Upload/output dirs are created with www-data ownership

## Notes
- Service name: ar-bbn-api
- App path: /var/www/ar-bbn
- Domain (FE): ar.cisan.id
- Domain (API): api.ar.cisan.id
