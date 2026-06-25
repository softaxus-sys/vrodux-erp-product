# Vrodux ERP — Disaster Recovery Guide

## Recovery Scenarios

### Scenario 1: Application Container Crash

**Symptoms:** API or Web returns 502, container status "unhealthy"

**Resolution:**
```bash
# Check container logs
docker logs vrodux-api --tail 200

# Restart the container
docker compose -f docker-compose.prod.yml up -d vrodux-api

# If persistent, rollback to previous version
bash scripts/rollback.sh
```

**RTO:** 2-5 minutes

### Scenario 2: Database Corruption or Data Loss

**Symptoms:** SQL errors, missing data, migration failures

**Resolution:**
```bash
# List available backups
ls -lt /opt/vrodux/backups/daily/

# Restore from latest daily backup
bash scripts/restore-db.sh /opt/vrodux/backups/daily/SoftaxisErpDb_daily_20260625_020000.bak

# For encrypted backups
bash scripts/restore-db.sh /opt/vrodux/backups/daily/SoftaxisErpDb_daily_20260625_020000.bak.enc
```

**RTO:** 10-30 minutes (depends on backup size)
**RPO:** Up to 24 hours (last daily backup)

### Scenario 3: Full Server Loss

**Resolution:**

1. Provision new Contabo VPS with Ubuntu 24.04
2. Run server bootstrap:
   ```bash
   sudo bash scripts/server-bootstrap.sh
   ```
3. Clone repository:
   ```bash
   cd /opt/vrodux && git clone <repo-url> current
   ```
4. Restore `.env` from secure backup or recreate
5. Start infrastructure:
   ```bash
   docker compose -f docker-compose.prod.yml up -d sqlserver redis seq
   ```
6. Wait for SQL Server health, then restore database:
   ```bash
   # Download backup from S3/B2 if configured
   aws s3 cp s3://vrodux-backups/daily/latest.bak.enc /tmp/

   bash scripts/restore-db.sh /tmp/latest.bak.enc --force
   ```
7. Setup SSL:
   ```bash
   sudo bash scripts/ssl-setup.sh erp.vrodux.com admin@vrodux.com
   ```
8. Deploy application:
   ```bash
   bash scripts/deploy.sh latest
   ```
9. Update DNS to point to new server IP

**RTO:** 1-2 hours
**RPO:** Up to 24 hours

### Scenario 4: SSL Certificate Expiry

**Resolution:**
```bash
# Force renewal
docker run --rm \
  -v vrodux-certbot-webroot:/var/www/certbot \
  -v vrodux-certbot-certs:/etc/letsencrypt \
  certbot/certbot renew --force-renewal

# Reload nginx
docker exec vrodux-nginx nginx -s reload
```

### Scenario 5: Docker Volume Data Loss

**Resolution:**
```bash
# Check volume status
docker volume ls | grep vrodux

# If sqlserver-data volume is lost, restore from backup
docker compose -f docker-compose.prod.yml up -d sqlserver
# Wait for healthy, then:
bash scripts/restore-db.sh <backup-file> --force
```

## Backup Schedule

| Type | Schedule | Retention | Location |
|------|----------|-----------|----------|
| Daily | 02:00 AM | 7 days | `/opt/vrodux/backups/daily/` + S3 |
| Weekly | Sunday 03:00 AM | 30 days | `/opt/vrodux/backups/weekly/` + S3 |
| Monthly | 1st of month 04:00 AM | 365 days | `/opt/vrodux/backups/monthly/` + S3 |

## Emergency Contacts

| Role | Action |
|------|--------|
| DevOps | Check container health, review deploy logs |
| DBA | Database restore, migration issues |
| Developer | Application-level debugging, code rollback |

## Verification Checklist

After any recovery:

- [ ] `curl https://erp.vrodux.com/health` returns `Healthy`
- [ ] All containers show "healthy" in `docker ps`
- [ ] Users can log in and access ERP modules
- [ ] Database has expected data (spot-check recent records)
- [ ] SSL certificate is valid (`openssl s_client -connect erp.vrodux.com:443`)
- [ ] Monitoring dashboards are receiving data
