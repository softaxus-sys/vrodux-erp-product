# Vrodux ERP — Backup & Restore Guide

## Backup Strategy

### Automated Schedule

| Type | Time | Retention | Encryption |
|------|------|-----------|------------|
| Daily | 02:00 AM (Asia/Dubai) | 7 days | Yes (AES-256) |
| Weekly | Sunday 03:00 AM | 30 days | Yes |
| Monthly | 1st of month 04:00 AM | 365 days | Yes |

Cron jobs are configured by `server-bootstrap.sh` in `/etc/cron.d/vrodux`.

### What Gets Backed Up

- **SQL Server database** (`SoftaxisErpDb`) — all schemas (identity, pos, inventory, sales, purchase, hr, finance, crm, construction, realestate, hospitality, restaurant, recipe, projectmanagement)
- Backups use SQL Server native `BACKUP DATABASE` with `COMPRESSION` and `CHECKSUM`

### What Does NOT Get Backed Up Automatically

- Docker volumes (Redis data, Seq data) — these are ephemeral/reconstructable
- Application configuration (`.env`) — back up manually or store in a secrets manager
- SSL certificates — certbot auto-renews; certificates stored in Docker volume

## Manual Backup

```bash
# Daily backup
bash scripts/backup-db.sh daily

# Weekly backup
bash scripts/backup-db.sh weekly

# Monthly backup
bash scripts/backup-db.sh monthly
```

## Backup Verification

Every backup automatically verifies integrity using `RESTORE VERIFYONLY`.

Manual verification:

```bash
# List recent backups
ls -lt /opt/vrodux/backups/daily/ | head -10

# Check backup file size (should be >0)
du -sh /opt/vrodux/backups/daily/*.bak*
```

## Restore

### Restore from Local Backup

```bash
# Interactive (asks for confirmation)
bash scripts/restore-db.sh /opt/vrodux/backups/daily/SoftaxisErpDb_daily_20260625_020000.bak

# Non-interactive (for scripts/automation)
bash scripts/restore-db.sh /opt/vrodux/backups/daily/SoftaxisErpDb_daily_20260625_020000.bak --force
```

### Restore from Encrypted Backup

```bash
# Requires BACKUP_ENCRYPTION_KEY in .env
bash scripts/restore-db.sh /opt/vrodux/backups/weekly/SoftaxisErpDb_weekly_20260622_030000.bak.enc
```

### Restore from Remote (S3/B2)

```bash
# Download from S3
aws s3 cp s3://vrodux-backups/daily/SoftaxisErpDb_daily_20260625_020000.bak.enc /tmp/

# Restore
bash scripts/restore-db.sh /tmp/SoftaxisErpDb_daily_20260625_020000.bak.enc --force
```

## Remote Backup Storage (S3/B2)

Configure in `/opt/vrodux/shared/.env`:

```bash
S3_BACKUP_BUCKET=vrodux-backups
S3_ENDPOINT=https://s3.us-west-001.backblazeb2.com  # For Backblaze B2
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
```

Install AWS CLI on the server:

```bash
sudo apt-get install -y awscli
```

## Backup Monitoring

Check backup logs:

```bash
tail -50 /opt/vrodux/logs/backup.log
```

Verify latest backup exists and is recent:

```bash
find /opt/vrodux/backups/daily/ -name "*.bak*" -mmin -1500 | head -1
# Should return a file (1500 minutes = 25 hours)
```
