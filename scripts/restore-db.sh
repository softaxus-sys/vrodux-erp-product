#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — SQL Server Restore Script
# Restores a database from a backup file (supports encrypted backups).
#
# Usage: ./scripts/restore-db.sh <backup-file> [--force]
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vrodux}"
ENV_FILE="${APP_DIR}/shared/.env"
DATABASE_NAME="${DATABASE_NAME:-SoftaxisErpDb}"
CONTAINER_NAME="${CONTAINER_NAME:-vrodux-sqlserver}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[RESTORE]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }
success() { echo -e "${GREEN}[OK]${NC}     $(date '+%Y-%m-%d %H:%M:%S') $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*"; }
error()   { echo -e "${RED}[FAIL]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }

if [[ -z "${1:-}" ]]; then
    error "Usage: $0 <backup-file> [--force]"
    echo ""
    echo "Available backups:"
    find "${APP_DIR}/backups" -name "*.bak*" -printf "  %T@ %p\n" 2>/dev/null | sort -rn | head -20 | cut -d' ' -f2-
    exit 1
fi

BACKUP_FILE="$1"
FORCE="${2:-}"

if [[ ! -f "$BACKUP_FILE" ]]; then
    error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment
if [[ -f "$ENV_FILE" ]]; then
    set -a; source "$ENV_FILE"; set +a
fi

SA_PASSWORD="${SQL_SA_PASSWORD:?SQL_SA_PASSWORD not set}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           Vrodux ERP — Database Restore                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
warn "Database: $DATABASE_NAME"
warn "Source:   $BACKUP_FILE"
echo ""

# ── Confirmation ──────────────────────────────────────────────────────────
if [[ "$FORCE" != "--force" ]]; then
    warn "THIS WILL REPLACE THE CURRENT DATABASE!"
    read -rp "Type 'YES' to confirm: " CONFIRM
    if [[ "$CONFIRM" != "YES" ]]; then
        info "Restore cancelled."
        exit 0
    fi
fi

# ── Decrypt if needed ─────────────────────────────────────────────────────
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.enc ]]; then
    if [[ -z "$ENCRYPTION_KEY" ]]; then
        error "Backup is encrypted but BACKUP_ENCRYPTION_KEY is not set."
        exit 1
    fi
    info "Decrypting backup..."
    DECRYPT_FILE="/tmp/vrodux_restore_$(date +%s).bak"
    openssl enc -aes-256-cbc -d -pbkdf2 \
        -in "$BACKUP_FILE" \
        -out "$DECRYPT_FILE" \
        -pass "pass:${ENCRYPTION_KEY}"
    RESTORE_FILE="$DECRYPT_FILE"
    success "Backup decrypted."
fi

# ── Stop API to prevent connections ───────────────────────────────────────
info "Stopping API container..."
docker stop vrodux-api 2>/dev/null || true
sleep 3

# ── Copy backup into container ────────────────────────────────────────────
info "Copying backup to SQL Server container..."
docker cp "$RESTORE_FILE" "${CONTAINER_NAME}:/tmp/restore.bak"

# Clean up decrypted temp file
if [[ "$RESTORE_FILE" == /tmp/* ]]; then
    rm -f "$RESTORE_FILE"
fi

# ── Kill active connections and restore ───────────────────────────────────
info "Restoring database (this may take several minutes)..."

docker exec "$CONTAINER_NAME" /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "$SA_PASSWORD" -C \
    -Q "
    ALTER DATABASE [$DATABASE_NAME] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    RESTORE DATABASE [$DATABASE_NAME]
    FROM DISK = N'/tmp/restore.bak'
    WITH REPLACE, STATS = 10;
    ALTER DATABASE [$DATABASE_NAME] SET MULTI_USER;
    "

if [[ $? -ne 0 ]]; then
    error "Restore FAILED!"
    docker exec "$CONTAINER_NAME" rm -f /tmp/restore.bak
    docker start vrodux-api
    exit 1
fi

# Cleanup
docker exec "$CONTAINER_NAME" rm -f /tmp/restore.bak

# ── Restart API ───────────────────────────────────────────────────────────
info "Starting API container..."
docker start vrodux-api

sleep 10

# ── Verify ────────────────────────────────────────────────────────────────
if curl -sf --max-time 10 "http://localhost:8080/health" > /dev/null 2>&1; then
    success "Restore complete and API is healthy!"
else
    warn "API health check pending — it may still be running migrations."
fi

echo ""
success "Database restored from: $(basename "$BACKUP_FILE")"
echo ""
