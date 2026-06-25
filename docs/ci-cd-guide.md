# Vrodux ERP — CI/CD Guide

## Pipeline Architecture

```
                    ┌──────────────┐
  PR to main/dev ──→│   CI Pipeline │──→ Pass/Fail feedback
                    │  (ci.yml)    │
                    └──────────────┘

                    ┌──────────────┐     ┌──────────┐     ┌──────────────┐
  Push to main ───→│ Build & Test │────→│ Push GHCR│────→│ Deploy (SSH) │
                    │              │     │          │     │  + Rollback  │
                    └──────────────┘     └──────────┘     └──────────────┘
                         deploy.yml (3 stages)
```

## CI Pipeline (`ci.yml`)

**Triggers:** Pull requests to `main` or `dev`, pushes to `dev`

**Jobs:**
1. **Backend** — `dotnet restore` → `dotnet build` → `dotnet test`
2. **Frontend** — `npm ci` → `npm run type-check` → `npm run build`
3. **Docker** — Test-build both images (no push)

## CD Pipeline (`deploy.yml`)

**Triggers:** Push to `main`, manual dispatch

### Stage 1: Build & Test
- Full .NET solution build
- Frontend type check
- Unit tests

### Stage 2: Build & Push Images
- Login to GitHub Container Registry
- Build API image (`docker/api/Dockerfile`) — multi-stage, Alpine-based
- Build Web image (`docker/web/Dockerfile`) — Node build → Nginx Alpine
- Push with commit SHA tag + `latest`
- Docker layer caching via GitHub Actions cache

### Stage 3: Deploy to Production
- SSH into Contabo VPS
- Save current images for rollback
- Pull new images
- Rolling container replacement
- Health check (30 attempts, 10s interval)
- Automatic rollback on failure
- Docker image cleanup

## GitHub Container Registry (GHCR)

Images are stored at:
```
ghcr.io/<owner>/<repo>/vrodux-api:<tag>
ghcr.io/<owner>/<repo>/vrodux-web:<tag>
```

Tags:
- `<7-char-sha>` — commit-specific (immutable)
- `latest` — most recent successful build

## Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `SERVER_HOST` | VPS IP address |
| `SERVER_USER` | SSH username (`deploy`) |
| `SERVER_SSH_KEY` | ED25519 private key |
| `SERVER_SSH_PORT` | SSH port (optional, defaults to 22) |
| `GHCR_PAT` | PAT for pulling images on server |
| `VITE_API_URL` | Frontend API base URL |

## Adding a GitHub Secret

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Enter name and value

## Generating SSH Key for CI

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/vrodux-deploy

# Add public key to server
ssh-copy-id -i ~/.ssh/vrodux-deploy.pub deploy@<server-ip>

# Copy private key content — this goes into SERVER_SSH_KEY secret
cat ~/.ssh/vrodux-deploy
```

## Environment Protection Rules

Configure in **Settings** → **Environments** → **production**:

- Required reviewers (optional)
- Wait timer (optional)
- Deployment branches: `main` only

## Troubleshooting

### Build fails on .NET restore
Check `NuGet.config` for private feed credentials.

### Docker build fails
The `.dockerignore` at repo root controls build context. Ensure required files are not excluded.

### Deployment SSH timeout
Increase `command_timeout` in the deploy workflow. Current: 10 minutes.

### Health check fails after deploy
1. Check API logs: `docker logs vrodux-api --tail 100`
2. Common causes: database connection string, migration failure, missing env vars
3. The pipeline auto-rolls back; investigate before re-deploying

### Images not pulling on server
Ensure GHCR PAT has `read:packages` scope and the server has run:
```bash
echo "$PAT" | docker login ghcr.io -u <github-user> --password-stdin
```
