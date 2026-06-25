# Vrodux ERP — Rollback Guide

## Automatic Rollback

The CI/CD pipeline automatically rolls back if the health check fails after deployment. No manual action is needed — the previous Docker images are restored and the API is verified healthy.

## Manual Rollback

### Quick Rollback (to previous release)

```bash
ssh deploy@<server-ip>
cd /opt/vrodux/current
bash scripts/rollback.sh
```

### Rollback to a Specific Release

```bash
# List available releases
ls -lt /opt/vrodux/releases/

# Rollback to a specific one
bash scripts/rollback.sh 20260625120000-abc1234
```

### Emergency Rollback (direct Docker commands)

If the rollback script fails:

```bash
cd /opt/vrodux/current

# Read previous image tags
PREV_API=$(cat /opt/vrodux/shared/.prev-api-image)
PREV_WEB=$(cat /opt/vrodux/shared/.prev-web-image)

# Stop current containers
docker stop vrodux-api vrodux-web

# Start with previous images
docker run -d --name vrodux-api --network vrodux-internal \
  --env-file /opt/vrodux/shared/.env \
  -p 127.0.0.1:8080:8080 \
  $PREV_API

# Verify
curl http://localhost:8080/health
```

## Database Rollback

If a migration caused issues:

1. Restore the database from the pre-deployment backup
2. Deploy the previous code version

```bash
# Restore database
bash scripts/restore-db.sh /opt/vrodux/backups/daily/<latest-backup>.bak

# Rollback application
bash scripts/rollback.sh
```

**Important:** Always restore the database BEFORE rolling back the code, since the previous code expects the previous schema.

## Rollback Verification

After any rollback:

```bash
# Check health
bash scripts/health-check.sh

# Verify correct image
docker inspect --format='{{.Config.Image}}' vrodux-api
docker inspect --format='{{.Config.Image}}' vrodux-web

# Check logs for errors
docker logs vrodux-api --tail 50
```
