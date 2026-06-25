# Vrodux ERP — Deployment Guide

## Overview

Vrodux ERP uses a fully automated CI/CD pipeline. Pushing to `main` triggers:

1. Build & test (.NET + frontend)
2. Docker image build and push to GitHub Container Registry (GHCR)
3. SSH deployment to Contabo VPS
4. Database migrations (automatic on API startup)
5. Health check verification
6. Automatic rollback on failure

## Prerequisites

### GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `SERVER_HOST` | Contabo VPS IP address |
| `SERVER_USER` | SSH user (default: `deploy`) |
| `SERVER_SSH_KEY` | SSH private key for deploy user |
| `SERVER_SSH_PORT` | SSH port (default: 22) |
| `GHCR_PAT` | GitHub PAT with `read:packages` scope |
| `VITE_API_URL` | Production API URL (e.g., `https://erp.vrodux.com`) |

### Server Preparation

1. Run server bootstrap: `sudo bash scripts/server-bootstrap.sh`
2. Clone the repo to `/opt/vrodux/current`
3. Copy `.env.example` to `/opt/vrodux/shared/.env` and fill in secrets
4. Run SSL setup: `sudo bash scripts/ssl-setup.sh erp.vrodux.com admin@vrodux.com`
5. Start infrastructure: `docker compose -f docker-compose.prod.yml up -d sqlserver redis seq nginx certbot`

## Deployment Flow

### Automatic (recommended)

```bash
git push origin main
```

The GitHub Actions `deploy.yml` workflow handles everything.

### Manual

```bash
# On the server
cd /opt/vrodux/current
export IMAGE_TAG=<commit-sha>
bash scripts/deploy.sh $IMAGE_TAG
```

## Rollback

### Automatic

If health checks fail after deployment, the pipeline automatically rolls back to the previous image.

### Manual

```bash
# Rollback to previous release
bash scripts/rollback.sh

# Rollback to a specific release
bash scripts/rollback.sh 20260625143000-abc1234
```

## Environment Configuration

All secrets are in `/opt/vrodux/shared/.env`. The API reads connection strings, JWT secrets, and service URLs from environment variables injected by Docker Compose.

Database migrations run automatically on API container startup when `ASPNETCORE_ENVIRONMENT=Docker` or `Production` (the `MigrateAndSeed*Async()` calls in `Program.cs`).

## Monitoring

Deploy the monitoring stack alongside production:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

Access:
- **Grafana**: `https://erp.vrodux.com/grafana/` (admin credentials in `.env`)
- **Seq**: `https://erp.vrodux.com/seq/`
- **Prometheus**: `http://localhost:9090` (internal only)

## Health Check

```bash
# Quick check
curl https://erp.vrodux.com/health

# Full status report
bash scripts/health-check.sh

# JSON output (for CI)
bash scripts/health-check.sh --json
```
