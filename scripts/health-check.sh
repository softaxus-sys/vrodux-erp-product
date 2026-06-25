#!/usr/bin/env bash
# ============================================================================
# Vrodux ERP — Health Check Script
# Checks all services and reports status.
#
# Usage: ./scripts/health-check.sh [--json]
# ============================================================================
set -euo pipefail

JSON_OUTPUT=false
[[ "${1:-}" == "--json" ]] && JSON_OUTPUT=true

HEALTH_API="http://localhost:8080/health"
HEALTH_WEB="http://localhost:3000/"
HEALTH_SEQ="http://localhost:5341/api"
HEALTH_NGINX="http://localhost:80/nginx-health"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
OVERALL_STATUS=0

check_http() {
    local name="$1" url="$2"
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
        [[ "$JSON_OUTPUT" == "false" ]] && echo -e "  ${GREEN}✓${NC} $name"
        return 0
    else
        [[ "$JSON_OUTPUT" == "false" ]] && echo -e "  ${RED}✗${NC} $name"
        OVERALL_STATUS=1
        return 1
    fi
}

check_container() {
    local name="$1"
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "not found")
    if [[ "$status" == "healthy" ]]; then
        [[ "$JSON_OUTPUT" == "false" ]] && echo -e "  ${GREEN}✓${NC} $name (healthy)"
        return 0
    else
        [[ "$JSON_OUTPUT" == "false" ]] && echo -e "  ${RED}✗${NC} $name ($status)"
        OVERALL_STATUS=1
        return 1
    fi
}

if [[ "$JSON_OUTPUT" == "true" ]]; then
    # JSON output for CI/CD
    RESULTS=()
    for svc in vrodux-api vrodux-web vrodux-sqlserver vrodux-redis vrodux-nginx vrodux-seq; do
        status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "not found")
        RESULTS+=("{\"service\":\"$svc\",\"status\":\"$status\"}")
    done
    API_STATUS=$(curl -sf --max-time 5 "$HEALTH_API" 2>/dev/null || echo '{"Status":"Unhealthy"}')
    echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"services\":[$(IFS=,; echo "${RESULTS[*]}")],\"api_health\":$API_STATUS}"
else
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║           Vrodux ERP — Health Check                          ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""

    echo "Container Health:"
    for svc in vrodux-api vrodux-web vrodux-sqlserver vrodux-redis vrodux-nginx vrodux-seq; do
        check_container "$svc" || true
    done

    echo ""
    echo "HTTP Endpoints:"
    check_http "API Health (/health)" "$HEALTH_API" || true
    check_http "Web Frontend"         "$HEALTH_WEB" || true
    check_http "Nginx"                "$HEALTH_NGINX" || true

    echo ""
    echo "Resource Usage:"
    docker stats --no-stream --format "  {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        vrodux-api vrodux-web vrodux-sqlserver vrodux-redis vrodux-nginx 2>/dev/null || true

    echo ""
    echo "Disk Usage:"
    echo "  Docker: $(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo 'N/A')"
    echo "  Volumes: $(docker system df -v --format '{{.Size}}' 2>/dev/null | tail -1 || echo 'N/A')"
    echo "  Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"

    echo ""
    if [[ $OVERALL_STATUS -eq 0 ]]; then
        echo -e "${GREEN}All services healthy.${NC}"
    else
        echo -e "${RED}Some services are unhealthy!${NC}"
    fi
    echo ""
fi

exit $OVERALL_STATUS
