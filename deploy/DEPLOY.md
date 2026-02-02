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

## Notes
- Service name: ar-bbn-api
- App path: /var/www/ar-bbn
- Domain (FE): ar.bbn.biz.id
- Domain (API): api.ar.bbn.biz.id
