# Vrodux ERP — Scaling Guide

## Current Architecture

Vrodux ERP runs as a modular monolith on a single Contabo VPS:

| Component | Resource Allocation |
|-----------|-------------------|
| SQL Server | 5 GB RAM, 3 CPU |
| Vrodux API | 3 GB RAM, 3 CPU |
| Redis | 768 MB RAM, 0.5 CPU |
| Seq | 1 GB RAM, 0.5 CPU |
| Nginx | 256 MB RAM, 0.5 CPU |
| Frontend | 256 MB RAM, 0.25 CPU |
| **Total** | **~10 GB RAM, 7.75 CPU** |

This supports **100-300 concurrent users** comfortably on the 24 GB / 8 vCPU server.

## Vertical Scaling (Quick)

### Upgrade Server Resources

Contabo allows live upgrades. For immediate relief:

1. Upgrade to next VPS tier (more RAM/CPU)
2. Adjust resource limits in `docker-compose.prod.yml`
3. Restart containers: `docker compose -f docker-compose.prod.yml up -d`

### SQL Server Memory

```yaml
# docker-compose.prod.yml
sqlserver:
  environment:
    MSSQL_MEMORY_LIMIT_MB: "8192"  # Increase from 4096
```

### Redis Memory

```yaml
redis:
  command: redis-server ... --maxmemory 1gb  # Increase from 512mb
```

## Horizontal Scaling

### Stage 1: Separate Database Server

Move SQL Server to a dedicated VPS:

1. Provision a database-optimized VPS
2. Run SQL Server container on the new server
3. Update connection strings in `.env`
4. Restore database backup on new server

### Stage 2: CDN for Frontend

Serve the frontend via Cloudflare or another CDN:

1. Build frontend static files
2. Upload to CDN (Cloudflare Pages, Vercel, etc.)
3. Point `erp.vrodux.com` to CDN
4. CDN proxies `/api/*` to the backend server

### Stage 3: Multiple API Instances

Run multiple API containers behind nginx load balancer:

```yaml
# docker-compose.prod.yml
vrodux-api:
  deploy:
    replicas: 2
```

Update nginx upstream:
```nginx
upstream vrodux_api {
    server vrodux-api-1:8080;
    server vrodux-api-2:8080;
    keepalive 32;
}
```

**Requirements for multi-instance:**
- Sticky sessions for SignalR (or use Redis backplane)
- Shared Redis for distributed caching
- Database handles concurrent connections

### Stage 4: Kubernetes (Enterprise Scale)

For 1000+ concurrent users, migrate to Kubernetes:

1. Convert Docker Compose to Helm charts
2. Use Azure SQL or managed SQL Server
3. Use Azure Redis Cache
4. Horizontal Pod Autoscaler (HPA) for API pods
5. Ingress controller replaces nginx

## Performance Optimization Checklist

### .NET API
- [ ] Enable response compression middleware
- [ ] Add response caching for read-heavy endpoints
- [ ] Enable connection pooling (EF Core default)
- [ ] Use `AsNoTracking()` for read queries
- [ ] Implement pagination for list endpoints

### SQL Server
- [ ] Add indexes for frequently queried columns
- [ ] Enable query store for performance monitoring
- [ ] Optimize `tempdb` (multiple files)
- [ ] Regular index maintenance (rebuild/reorganize)

### Redis
- [ ] Cache frequently accessed reference data
- [ ] Use Redis for SignalR backplane (multi-instance)
- [ ] Cache JWT validation results

### Nginx
- [ ] Enable proxy caching for static API responses
- [ ] Tune worker connections based on load
- [ ] Enable HTTP/2 push for critical assets

### Frontend
- [ ] Vite chunk splitting (already configured)
- [ ] Aggressive cache headers for hashed assets
- [ ] Lazy-load non-critical modules
