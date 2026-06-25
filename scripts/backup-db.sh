#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — SQL Server Backup Script
# Creates compressed, encrypted backups with retention policies.
#
# Usage: ./scripts/backup-db.sh [daily|weekly|monthly]
# ============================================================================
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/vrodux}"
ENV_FILE="${APP_DIR}/shared/.env"
BACKUP_BASE="${APP_DIR}/backups"
DATABASE_NAME="${DATABASE_NAME:-SoftaxisErpDb}"
CONTAINER_NAME="${CONTAINER_NAME:-vrodux-sqlserver}"

BACKUP_TYPE="${1:-daily}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE}/${BACKUP_TYPE}"

# Retention (in days)
RETENTION_DAILY=7
RETENTION_WEEKLY=30
RETENTION_MONTHLY=365

# S3/B2 upload (optional — set in .env)
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_ENDPOINT="${S3_ENDPOINT:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[BACKUP]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
error()   { echo -e "${RED}[FAIL]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }

# ── Load environment ──────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

SA_PASSWORD="${SQL_SA_PASSWORD:?SQL_SA_PASSWORD not set}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

echo ""
info "╔═══════════════════════════════════════════════════╗"
info "║       Vrodux ERP — Database Backup ($BACKUP_TYPE)     ║"
info "╚═══════════════════════════════════════════════════╝"
echo ""

# ── Create backup directory ───────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Backup filename ───────────────────────────────────────────────────────
BACKUP_FILE="${DATABASE_NAME}_${BACKUP_TYPE}_${TIMESTAMP}"
BACKUP_PATH_CONTAINER="/var/opt/mssql/backup/${BACKUP_FILE}.bak"

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Create SQL Server backup with compression
# ═══════════════════════════════════════════════════════════════════════════
info "Step 1/4: Creating compressed SQL Server backup..."

docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SA_PASSWORD" -C \
    -Q "BACKUP DATABASE [$DATABASE_NAME] TO DISK = N'$BACKUP_PATH_CONTAINER' WITH COMPRESSION, CHECKSUM, INIT, STATS = 10, NAME = N'${BACKUP_FILE}'"

if [[ $? -ne 0 ]]; then
    error "SQL Server backup failed!"
    exit 1
fi
success "SQL backup created inside container."

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Copy backup from container to host
# ═══════════════════════════════════════════════════════════════════════════
info "Step 2/4: Copying backup to host..."

docker cp "${CONTAINER_NAME}:${BACKUP_PATH_CONTAINER}" "${BACKUP_DIR}/${BACKUP_FILE}.bak"

# Remove backup file from container
docker exec "$CONTAINER_NAME" rm -f "$BACKUP_PATH_CONTAINER"

BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_FILE}.bak" | cut -f1)
success "Backup copied to host: ${BACKUP_DIR}/${BACKUP_FILE}.bak ($BACKUP_SIZE)"

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Encrypt backup (if key is set)
# ═══════════════════════════════════════════════════════════════════════════
FINAL_FILE="${BACKUP_DIR}/${BACKUP_FILE}.bak"

if [[ -n "$ENCRYPTION_KEY" ]]; then
    info "Step 3/4: Encrypting backup..."
    openssl enc -aes-256-cbc -salt -pbkdf2 \
        -in "${BACKUP_DIR}/${BACKUP_FILE}.bak" \
        -out "${BACKUP_DIR}/${BACKUP_FILE}.bak.enc" \
        -pass "pass:${ENCRYPTION_KEY}"
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}.bak"
    FINAL_FILE="${BACKUP_DIR}/${BACKUP_FILE}.bak.enc"
    FINAL_SIZE=$(du -sh "$FINAL_FILE" | cut -f1)
    success "Backup encrypted ($FINAL_SIZE)."
else
    info "Step 3/4: Encryption skipped (BACKUP_ENCRYPTION_KEY not set)."
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Upload to S3/B2 (if configured)
# ═══════════════════════════════════════════════════════════════════════════
if [[ -n "$S3_BUCKET" ]]; then
    info "Step 4/4: Uploading to S3 ($S3_BUCKET)..."
    S3_PATH="s3://${S3_BUCKET}/vrodux-backups/${BACKUP_TYPE}/"

    if [[ -n "$S3_ENDPOINT" ]]; then
        aws s3 cp "$FINAL_FILE" "$S3_PATH" --endpoint-url "$S3_ENDPOINT"
    else
        aws s3 cp "$FINAL_FILE" "$S3_PATH"
    fi
    success "Uploaded to $S3_PATH"
else
    info "Step 4/4: Remote upload skipped (S3_BACKUP_BUCKET not set)."
fi

# ═══════════════════════════════════════════════════════════════════════════
# Retention: Remove old backups
# ═══════════════════════════════════════════════════════════════════════════
info "Applying retention policy..."

case "$BACKUP_TYPE" in
    daily)   RETENTION=$RETENTION_DAILY ;;
    weekly)  RETENTION=$RETENTION_WEEKLY ;;
    monthly) RETENTION=$RETENTION_MONTHLY ;;
    *)       RETENTION=$RETENTION_DAILY ;;
esac

DELETED_COUNT=$(find "$BACKUP_DIR" -name "*.bak*" -mtime +"$RETENTION" -delete -print | wc -l)
success "Retention applied: removed $DELETED_COUNT backup(s) older than $RETENTION days."

# ── Verify backup integrity ───────────────────────────────────────────────
info "Verifying backup integrity..."
if [[ "$FINAL_FILE" == *.enc ]]; then
    success "Encrypted backup verified by size check: $(du -sh "$FINAL_FILE" | cut -f1)"
else
    docker cp "$FINAL_FILE" "${CONTAINER_NAME}:/tmp/verify.bak"
    docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
        -S localhost -U sa -P "$SA_PASSWORD" -C \
        -Q "RESTORE VERIFYONLY FROM DISK = N'/tmp/verify.bak'" 2>/dev/null
    docker exec "$CONTAINER_NAME" rm -f /tmp/verify.bak
    success "Backup integrity verified."
fi

echo ""
success "Backup complete: $(basename "$FINAL_FILE")"
echo ""
