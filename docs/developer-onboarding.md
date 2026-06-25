# Vrodux ERP — Developer Onboarding Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| .NET SDK | 10.0+ | Backend development |
| Node.js | 22+ | Frontend development |
| Docker Desktop | Latest | Local infrastructure |
| Git | Latest | Version control |
| VS Code or Rider | Latest | IDE |

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/<org>/vrodux-erp-product.git
cd vrodux-erp-product
```

### 2. Start Local Infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- **SQL Server** on `localhost:1433` (sa/VroduxDev@2026!)
- **Redis** on `localhost:6379` (password: devredis123)
- **Seq** on `http://localhost:5341` (structured log viewer)

### 3. Backend Setup

```bash
cd Backend

# Restore packages
dotnet restore Softaxis.ERP.slnx

# Run the API Gateway (hosts all modules)
dotnet run --project src/ApiGateway/Softaxis.ApiGateway

# API available at http://localhost:5000
# Scalar API docs at http://localhost:5000/scalar/v1
```

The API auto-migrates all databases on first run (Development environment).

### 4. Frontend Setup

```bash
cd FrontendVite

# Install dependencies
npm install

# Start dev server
npm run dev

# Frontend available at http://localhost:5173
```

### 5. Verify

- Open `http://localhost:5173` — you should see the login page
- Open `http://localhost:5341` — Seq log viewer
- Open `http://localhost:5000/health` — API health check

## Project Structure

```
vrodux-erp-product/
├── Backend/                     # .NET 10 backend
│   ├── Softaxis.ERP.slnx       # Solution file
│   └── src/
│       ├── ApiGateway/          # Single deployable: hosts all module controllers
│       ├── BuildingBlocks/      # Shared: Domain, Application, Infrastructure
│       └── Services/
│           ├── Identity/        # Auth, users, tenants
│           ├── HR/              # Employees, payroll, leaves, attendance
│           ├── Finance/         # Invoices, journals, budgets, expenses, AP
│           ├── Inventory/       # Products, warehouses, stock
│           ├── Sales/           # Orders, returns, delivery challans
│           ├── Purchase/        # Orders, GRN, returns, vendors
│           ├── CRM/             # Leads, customers, pipeline
│           ├── POS/             # Point of sale
│           ├── ProjectManagement/ # Kanban, sprints, issues
│           ├── Construction/    # Construction projects
│           ├── RealEstate/      # Properties
│           ├── Hospitality/     # Hotel rooms
│           ├── Restaurant/      # Table management
│           └── Recipe/          # Recipe management
├── FrontendVite/                # React + Vite + TypeScript
│   └── src/
│       ├── components/ui/       # Shared UI components
│       ├── hooks/               # React Query hooks per module
│       ├── lib/                 # API clients, utilities
│       ├── modules/             # Feature modules (HR, Finance, etc.)
│       └── pages/               # Route pages
├── docker/                      # Production Dockerfiles
├── docker-compose.*.yml         # Dev, staging, prod, monitoring
├── nginx/                       # Reverse proxy config
├── scripts/                     # Deployment and maintenance scripts
├── monitoring/                  # Prometheus, Grafana, Loki configs
└── docs/                        # Documentation
```

## Architecture

**Backend:** Modular monolith — all modules compile into a single API Gateway binary. Each module has its own Domain/Application/Infrastructure layers but shares a single SQL Server database (`SoftaxisErpDb`) with per-module schemas.

**CQRS Pattern (mandatory for new code):**
```
Controller (ISender only) → Command/Query → Handler (DbContext) → Result<T>
```

See `CLAUDE.md` for the full CQRS architecture reference.

**Frontend:** React SPA with module-based organization. API calls go through typed API clients in `lib/`, wrapped in React Query hooks in `hooks/`.

## Development Workflow

1. Create a feature branch from `dev`
2. Make changes, commit
3. Push and create a PR to `dev`
4. CI pipeline runs (build + test + type check)
5. After review, merge to `dev`
6. When ready for production: merge `dev` → `main`
7. CD pipeline deploys automatically

## Connection Strings (Development)

```
SQL Server: Server=localhost;Database=SoftaxisErpDb;User Id=sa;Password=VroduxDev@2026!;TrustServerCertificate=True;
Redis:      localhost:6379,password=devredis123
Seq:        http://localhost:5341
```

## Useful Commands

```bash
# Backend
dotnet build Backend/Softaxis.ERP.slnx          # Build all
dotnet test Backend/Softaxis.ERP.slnx            # Run tests

# Frontend
cd FrontendVite
npm run type-check                                # TypeScript check
npm run build                                     # Production build
npm run dev                                       # Dev server

# Docker
docker compose -f docker-compose.dev.yml up -d    # Start infra
docker compose -f docker-compose.dev.yml down      # Stop infra
docker compose -f docker-compose.dev.yml logs -f   # View logs

# Database
docker exec -it vrodux-dev-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "VroduxDev@2026!" -C      # SQL prompt
```
