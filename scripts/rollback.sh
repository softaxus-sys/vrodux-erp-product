#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — Rollback Script
# Rolls back to a previous release or the last known good deployment.
#
# Usage: ./scripts/rollback.sh [RELEASE_ID]
#   No argument = rollback to the previous release
#   With argument = rollback to a specific release
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vrodux}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${APP_DIR}/shared/.env"
DEPLOY_LOG="${APP_DIR}/logs/deploy.log"
HEALTH_CHECK_URL="http://localhost:8080/health"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[ROLLBACK]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG"; }
success() { echo -e "${GREEN}[OK]${NC}       $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG"; }
error()   { echo -e "${RED}[FAIL]${NC}     $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG" >&2; }

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║             Vrodux ERP — Rollback                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ── Find target release ───────────────────────────────────────────────────
RELEASES_DIR="${APP_DIR}/releases"
cd "$RELEASES_DIR"

if [[ -n "${1:-}" ]]; then
    TARGET_RELEASE="$1"
    if [[ ! -d "$TARGET_RELEASE" ]]; then
        error "Release not found: $TARGET_RELEASE"
        echo "Available releases:"
        ls -1d 20* 2>/dev/null | sort -r | head -10
        exit 1
    fi
else
    RELEASES=($(ls -1d 20* 2>/dev/null | sort -r || true))
    if [[ ${#RELEASES[@]} -lt 2 ]]; then
        error "No previous release to rollback to."
        exit 1
    fi
    TARGET_RELEASE="${RELEASES[1]}"
fi

info "Target release: $TARGET_RELEASE"

# ── Read deployment metadata ──────────────────────────────────────────────
if [[ -f "$TARGET_RELEASE/deployment.json" ]]; then
    TARGET_TAG=$(jq -r '.image_tag' "$TARGET_RELEASE/deployment.json")
    info "Target image tag: $TARGET_TAG"
else
    error "No deployment metadata found in $TARGET_RELEASE"
    exit 1
fi

# ── Pull and deploy target images ─────────────────────────────────────────
info "Rolling back to tag: $TARGET_TAG..."

set -a; source "$ENV_FILE"; set +a
export IMAGE_TAG="$TARGET_TAG"

docker compose -f "${APP_DIR}/current/$COMPOSE_FILE" --env-file "$ENV_FILE" pull vrodux-api vrodux-web 2>/dev/null || true

docker compose -f "${APP_DIR}/current/$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
    --no-deps --force-recreate \
    vrodux-api vrodux-web

# ── Health check ──────────────────────────────────────────────────────────
info "Waiting for health check..."
sleep 15

for i in $(seq 1 20); do
    if curl -sf --max-time 5 "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        success "Rollback successful! Running on release: $TARGET_RELEASE (tag: $TARGET_TAG)"
        ln -sfn "$RELEASES_DIR/$TARGET_RELEASE" "${RELEASES_DIR}/current"
        exit 0
    fi
    info "  Health check attempt $i/20..."
    sleep 5
done

error "CRITICAL: Rollback health check failed! Manual intervention required."
error "Check: docker logs vrodux-api --tail 100"
exit 1
