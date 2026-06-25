# Vrodux ERP — Server Setup Guide

## Server Specifications

| Spec | Value |
|------|-------|
| Provider | Contabo Cloud VPS 30 |
| OS | Ubuntu Server 24.04 LTS |
| CPU | 8 vCPU |
| RAM | 24 GB |
| Storage | 200 GB NVMe |
| Location | Choose nearest to users |

## Initial Server Setup

### Step 1: SSH into the server

```bash
ssh root@<server-ip>
```

### Step 2: Run the bootstrap script

Upload and run:

```bash
curl -sSL https://raw.githubusercontent.com/<repo>/main/scripts/server-bootstrap.sh | \
  DEPLOY_USER=deploy DOMAIN=erp.vrodux.com TIMEZONE=Asia/Dubai sudo bash
```

This script installs and configures:
- System packages (git, curl, jq, htop, etc.)
- Docker Engine + Docker Compose plugin
- UFW firewall (ports 22, 80, 443)
- Fail2Ban (SSH brute-force protection)
- SSH hardening (key-only auth, root login disabled)
- Automatic security updates
- 4 GB swap
- Sysctl optimization for ERP workloads
- Log rotation
- Application directory structure at `/opt/vrodux`
- Cron jobs for backups and Docker cleanup

### Step 3: Add SSH key for deploy user

```bash
# On your local machine
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<server-ip>

# Verify
ssh deploy@<server-ip>
```

### Step 4: Clone repository

```bash
sudo -u deploy bash
cd /opt/vrodux
git clone https://github.com/<repo>.git current
```

### Step 5: Configure environment

```bash
cp /opt/vrodux/current/.env.example /opt/vrodux/shared/.env
nano /opt/vrodux/shared/.env  # Fill in all secrets
```

Generate secure passwords:

```bash
# SQL Server password (min 8 chars, uppercase, lowercase, digit, special)
openssl rand -base64 32

# JWT Secret (64+ chars)
openssl rand -base64 64

# Redis password
openssl rand -base64 24

# Backup encryption key
openssl rand -base64 32
```

### Step 6: Start infrastructure services

```bash
cd /opt/vrodux/current
docker compose -f docker-compose.prod.yml --env-file /opt/vrodux/shared/.env \
  up -d sqlserver redis seq
```

Wait for SQL Server to be healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

### Step 7: SSL certificate

```bash
sudo bash scripts/ssl-setup.sh erp.vrodux.com admin@vrodux.com
```

### Step 8: Deploy application

```bash
bash scripts/deploy.sh latest
```

### Step 9: Verify

```bash
bash scripts/health-check.sh
curl https://erp.vrodux.com/health
```

## Directory Structure

```
/opt/vrodux/
├── current/            → symlink or git clone of the repo
├── releases/           → deployment history
│   ├── 20260625143000-abc1234/
│   │   └── deployment.json
│   └── current → latest release
├── shared/
│   ├── .env            → production secrets
│   ├── .prev-api-image → rollback reference
│   └── .prev-web-image
├── logs/
│   ├── deploy.log
│   ├── backup.log
│   └── certbot.log
├── backups/
│   ├── daily/
│   ├── weekly/
│   └── monthly/
├── scripts/            → symlinked from current/scripts
└── ssl/
```

## Firewall Rules

| Port | Service | Access |
|------|---------|--------|
| 22 (or custom) | SSH | Restricted |
| 80 | HTTP (redirect to HTTPS) | Public |
| 443 | HTTPS | Public |
| 1433 | SQL Server | Localhost only |
| 6379 | Redis | Localhost only |
| 5341 | Seq | Localhost only |
| 8080 | API | Localhost only (behind nginx) |
| 3000 | Frontend | Localhost only (behind nginx) |
| 9090 | Prometheus | Localhost only |
| 3100 | Grafana | Localhost only (proxied via nginx) |
