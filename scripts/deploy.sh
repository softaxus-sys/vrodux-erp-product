#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — Production Deployment Script
# Performs rolling container replacement with automatic rollback on failure.
#
# Usage: ./scripts/deploy.sh [IMAGE_TAG]
# Called by GitHub Actions or manually on the server.
# ============================================================================
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/vrodux}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${APP_DIR}/shared/.env"
DEPLOY_LOG="${APP_DIR}/logs/deploy.log"
MAX_RELEASES=10
HEALTH_CHECK_URL="http://localhost:8080/health"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

IMAGE_TAG="${1:-${IMAGE_TAG:-latest}}"

# ── Color helpers ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG"; }
success() { echo -e "${GREEN}[OK]${NC}     $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG"; }
error()   { echo -e "${RED}[FAIL]${NC}   $(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$DEPLOY_LOG" >&2; }

# ── Pre-flight ─────────────────────────────────────────────────────────────
cd "$APP_DIR/current" 2>/dev/null || cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
    error "Environment file not found: $ENV_FILE"
    exit 1
fi

RELEASE_ID="$(date +%Y%m%d%H%M%S)-${IMAGE_TAG}"
RELEASE_DIR="${APP_DIR}/releases/${RELEASE_ID}"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           Vrodux ERP — Production Deployment                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
info "Release:    $RELEASE_ID"
info "Image tag:  $IMAGE_TAG"
info "Compose:    $COMPOSE_FILE"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Save current state for rollback
# ═══════════════════════════════════════════════════════════════════════════
info "Step 1/7: Saving current state for rollback..."

PREV_API_IMAGE=$(docker inspect --format='{{.Config.Image}}' vrodux-api 2>/dev/null || echo "none")
PREV_WEB_IMAGE=$(docker inspect --format='{{.Config.Image}}' vrodux-web 2>/dev/null || echo "none")

echo "$PREV_API_IMAGE" > "${APP_DIR}/shared/.prev-api-image"
echo "$PREV_WEB_IMAGE" > "${APP_DIR}/shared/.prev-web-image"

success "Previous images saved: API=$PREV_API_IMAGE, Web=$PREV_WEB_IMAGE"

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Pull new images
# ═══════════════════════════════════════════════════════════════════════════
info "Step 2/7: Pulling new Docker images (tag: $IMAGE_TAG)..."

export IMAGE_TAG
set -a; source "$ENV_FILE"; set +a

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull vrodux-api vrodux-web
success "Images pulled successfully."

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Create release directory
# ═══════════════════════════════════════════════════════════════════════════
info "Step 3/7: Creating release directory..."
mkdir -p "$RELEASE_DIR"

# Save deployment metadata
cat > "$RELEASE_DIR/deployment.json" <<METAEOF
{
    "release_id": "$RELEASE_ID",
    "image_tag": "$IMAGE_TAG",
    "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "deployed_by": "${DEPLOY_USER:-ci}",
    "prev_api_image": "$PREV_API_IMAGE",
    "prev_web_image": "$PREV_WEB_IMAGE"
}
METAEOF

success "Release directory created: $RELEASE_DIR"

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Run database migrations (via API container startup)
# ═══════════════════════════════════════════════════════════════════════════
info "Step 4/7: Database migrations will run on API container startup..."
success "EF Core auto-migration enabled via ASPNETCORE_ENVIRONMENT=Docker|Production."

# ═══════════════════════════════════════════════════════════════════════════
# Step 5: Rolling container replacement
# ═══════════════════════════════════════════════════════════════════════════
info "Step 5/7: Deploying new containers..."

# Stop and recreate only the app containers (not infra)
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
    --no-deps --force-recreate \
    vrodux-api vrodux-web

# Wait for containers to be running
sleep 5
info "Containers started. Waiting for health checks..."

# ═══════════════════════════════════════════════════════════════════════════
# Step 6: Health check with retry
# ═══════════════════════════════════════════════════════════════════════════
info "Step 6/7: Running health checks..."

HEALTHY=false
for i in $(seq 1 "$HEALTH_CHECK_RETRIES"); do
    if curl -sf --max-time 5 "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    info "  Health check attempt $i/$HEALTH_CHECK_RETRIES — waiting ${HEALTH_CHECK_INTERVAL}s..."
    sleep "$HEALTH_CHECK_INTERVAL"
done

if [[ "$HEALTHY" != "true" ]]; then
    error "Health check FAILED after $HEALTH_CHECK_RETRIES attempts!"
    error "Initiating automatic rollback..."

    # ── Automatic Rollback ──────────────────────────────────────────────
    if [[ "$PREV_API_IMAGE" != "none" ]]; then
        warn "Rolling back to previous images..."
        docker stop vrodux-api vrodux-web 2>/dev/null || true
        docker rm vrodux-api vrodux-web 2>/dev/null || true

        # Restore previous images
        export IMAGE_TAG="$(echo "$PREV_API_IMAGE" | grep -oP ':\K.*' || echo 'latest')"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
            --no-deps vrodux-api vrodux-web

        sleep 15
        if curl -sf --max-time 5 "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            warn "Rollback successful — previous version restored."
        else
            error "CRITICAL: Rollback also failed! Manual intervention required."
        fi
    fi

    # Mark release as failed
    echo "FAILED" > "$RELEASE_DIR/status"
    exit 1
fi

success "Health check passed!"

# ═══════════════════════════════════════════════════════════════════════════
# Step 7: Cleanup
# ═══════════════════════════════════════════════════════════════════════════
info "Step 7/7: Cleaning up..."

# Update current symlink
ln -sfn "$RELEASE_DIR" "${APP_DIR}/releases/current"

# Mark release as successful
echo "SUCCESS" > "$RELEASE_DIR/status"

# Remove old releases (keep last N)
cd "${APP_DIR}/releases"
RELEASES=($(ls -1d 20* 2>/dev/null | sort -r || true))
if [[ ${#RELEASES[@]} -gt $MAX_RELEASES ]]; then
    for old in "${RELEASES[@]:$MAX_RELEASES}"; do
        info "Removing old release: $old"
        rm -rf "$old"
    done
fi

# Prune unused Docker images
docker image prune -f --filter "until=24h" > /dev/null 2>&1 || true

# Reload nginx to pick up any config changes
docker exec vrodux-nginx nginx -s reload 2>/dev/null || true

success "Cleanup complete."

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              Deployment Successful!                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
success "Release:  $RELEASE_ID"
success "API:      $(docker inspect --format='{{.Config.Image}}' vrodux-api)"
success "Web:      $(docker inspect --format='{{.Config.Image}}' vrodux-web)"
success "Health:   $(curl -s "$HEALTH_CHECK_URL" | jq -r '.Status // "OK"' 2>/dev/null || echo "OK")"
echo ""
