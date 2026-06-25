#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — SSL Certificate Setup (Let's Encrypt)
#
# Usage: sudo ./scripts/ssl-setup.sh <domain> <email>
# Example: sudo ./scripts/ssl-setup.sh erp.vrodux.com admin@vrodux.com
# ============================================================================
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"
APP_DIR="${APP_DIR:-/opt/vrodux}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[SSL]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC} $*" >&2; }

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           Vrodux ERP — SSL Certificate Setup                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
info "Domain: $DOMAIN"
info "Email:  $EMAIL"
echo ""

# ── Step 1: Ensure nginx is running with HTTP for ACME challenge ──────────
info "Step 1: Starting nginx for ACME challenge..."

# Create a temporary nginx config that only serves ACME challenges
TEMP_CONF="/tmp/nginx-acme.conf"
cat > "$TEMP_CONF" <<ACMECONF
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / { return 200 "waiting for cert"; }
    }
}
ACMECONF

# Start a temporary nginx for the challenge
docker run -d --name certbot-nginx-temp \
    -p 80:80 \
    -v "$(docker volume inspect vrodux-certbot-webroot -f '{{.Mountpoint}}' 2>/dev/null || echo '/tmp/certbot-webroot'):/var/www/certbot" \
    -v "$TEMP_CONF:/etc/nginx/nginx.conf:ro" \
    nginx:1.27-alpine 2>/dev/null || true

sleep 2

# ── Step 2: Obtain certificate ────────────────────────────────────────────
info "Step 2: Requesting certificate from Let's Encrypt..."

docker run --rm \
    -v vrodux-certbot-webroot:/var/www/certbot \
    -v vrodux-certbot-certs:/etc/letsencrypt \
    certbot/certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --force-renewal

if [[ $? -eq 0 ]]; then
    success "SSL certificate obtained!"
else
    error "Failed to obtain certificate. Check DNS and firewall."
    docker stop certbot-nginx-temp 2>/dev/null; docker rm certbot-nginx-temp 2>/dev/null
    exit 1
fi

# ── Step 3: Cleanup temp nginx ────────────────────────────────────────────
docker stop certbot-nginx-temp 2>/dev/null || true
docker rm certbot-nginx-temp 2>/dev/null || true
rm -f "$TEMP_CONF"

# ── Step 4: Update nginx config with correct domain ───────────────────────
info "Step 3: Updating nginx configuration..."

NGINX_CONF="${APP_DIR}/current/nginx/conf.d/vrodux.conf"
if [[ -f "$NGINX_CONF" ]]; then
    sed -i "s/erp\.vrodux\.com/$DOMAIN/g" "$NGINX_CONF"
    success "Nginx config updated with domain: $DOMAIN"
fi

# ── Step 5: Restart full stack ────────────────────────────────────────────
info "Step 4: Restarting nginx with SSL..."

cd "$APP_DIR/current"
docker compose -f docker-compose.prod.yml --env-file "$APP_DIR/shared/.env" up -d nginx
docker exec vrodux-nginx nginx -t && docker exec vrodux-nginx nginx -s reload

echo ""
success "SSL setup complete!"
success "Site available at: https://$DOMAIN"
echo ""
warn "Certificate auto-renewal is handled by the certbot container."
echo ""
