# ============================================================================
# Vrodux ERP — Production API Dockerfile
# Multi-stage build for .NET 10 Modular Monolith (API Gateway)
# ============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Install ICU for globalization support
RUN apk add --no-cache icu-libs

# Copy solution and NuGet config first for layer caching
COPY Backend/Softaxis.ERP.slnx ./
COPY Backend/NuGet.config ./

# Copy all project files for restore layer caching
COPY Backend/src/BuildingBlocks/Softaxis.BuildingBlocks.Domain/Softaxis.BuildingBlocks.Domain.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Domain/
COPY Backend/src/BuildingBlocks/Softaxis.BuildingBlocks.Application/Softaxis.BuildingBlocks.Application.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Application/
COPY Backend/src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/Softaxis.BuildingBlocks.Infrastructure.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/

COPY Backend/src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj \
     src/ApiGateway/Softaxis.ApiGateway/

COPY Backend/src/Services/Identity/Softaxis.Identity.Domain/Softaxis.Identity.Domain.csproj \
     src/Services/Identity/Softaxis.Identity.Domain/
COPY Backend/src/Services/Identity/Softaxis.Identity.Application/Softaxis.Identity.Application.csproj \
     src/Services/Identity/Softaxis.Identity.Application/
COPY Backend/src/Services/Identity/Softaxis.Identity.Infrastructure/Softaxis.Identity.Infrastructure.csproj \
     src/Services/Identity/Softaxis.Identity.Infrastructure/
COPY Backend/src/Services/Identity/Softaxis.Identity.API/Softaxis.Identity.API.csproj \
     src/Services/Identity/Softaxis.Identity.API/

COPY Backend/src/Services/POS/Softaxis.POS.Domain/Softaxis.POS.Domain.csproj \
     src/Services/POS/Softaxis.POS.Domain/
COPY Backend/src/Services/POS/Softaxis.POS.Application/Softaxis.POS.Application.csproj \
     src/Services/POS/Softaxis.POS.Application/
COPY Backend/src/Services/POS/Softaxis.POS.Infrastructure/Softaxis.POS.Infrastructure.csproj \
     src/Services/POS/Softaxis.POS.Infrastructure/
COPY Backend/src/Services/POS/Softaxis.POS.API/Softaxis.POS.API.csproj \
     src/Services/POS/Softaxis.POS.API/

COPY Backend/src/Services/Inventory/Softaxis.Inventory.Domain/Softaxis.Inventory.Domain.csproj \
     src/Services/Inventory/Softaxis.Inventory.Domain/
COPY Backend/src/Services/Inventory/Softaxis.Inventory.Application/Softaxis.Inventory.Application.csproj \
     src/Services/Inventory/Softaxis.Inventory.Application/
COPY Backend/src/Services/Inventory/Softaxis.Inventory.Infrastructure/Softaxis.Inventory.Infrastructure.csproj \
     src/Services/Inventory/Softaxis.Inventory.Infrastructure/
COPY Backend/src/Services/Inventory/Softaxis.Inventory.API/Softaxis.Inventory.API.csproj \
     src/Services/Inventory/Softaxis.Inventory.API/

COPY Backend/src/Services/Sales/Softaxis.Sales.Domain/Softaxis.Sales.Domain.csproj \
     src/Services/Sales/Softaxis.Sales.Domain/
COPY Backend/src/Services/Sales/Softaxis.Sales.Application/Softaxis.Sales.Application.csproj \
     src/Services/Sales/Softaxis.Sales.Application/
COPY Backend/src/Services/Sales/Softaxis.Sales.Infrastructure/Softaxis.Sales.Infrastructure.csproj \
     src/Services/Sales/Softaxis.Sales.Infrastructure/
COPY Backend/src/Services/Sales/Softaxis.Sales.API/Softaxis.Sales.API.csproj \
     src/Services/Sales/Softaxis.Sales.API/

COPY Backend/src/Services/Purchase/Softaxis.Purchase.Domain/Softaxis.Purchase.Domain.csproj \
     src/Services/Purchase/Softaxis.Purchase.Domain/
COPY Backend/src/Services/Purchase/Softaxis.Purchase.Application/Softaxis.Purchase.Application.csproj \
     src/Services/Purchase/Softaxis.Purchase.Application/
COPY Backend/src/Services/Purchase/Softaxis.Purchase.Infrastructure/Softaxis.Purchase.Infrastructure.csproj \
     src/Services/Purchase/Softaxis.Purchase.Infrastructure/
COPY Backend/src/Services/Purchase/Softaxis.Purchase.API/Softaxis.Purchase.API.csproj \
     src/Services/Purchase/Softaxis.Purchase.API/

COPY Backend/src/Services/HR/Softaxis.HR.Domain/Softaxis.HR.Domain.csproj \
     src/Services/HR/Softaxis.HR.Domain/
COPY Backend/src/Services/HR/Softaxis.HR.Application/Softaxis.HR.Application.csproj \
     src/Services/HR/Softaxis.HR.Application/
COPY Backend/src/Services/HR/Softaxis.HR.Infrastructure/Softaxis.HR.Infrastructure.csproj \
     src/Services/HR/Softaxis.HR.Infrastructure/
COPY Backend/src/Services/HR/Softaxis.HR.API/Softaxis.HR.API.csproj \
     src/Services/HR/Softaxis.HR.API/

COPY Backend/src/Services/Finance/Softaxis.Finance.Domain/Softaxis.Finance.Domain.csproj \
     src/Services/Finance/Softaxis.Finance.Domain/
COPY Backend/src/Services/Finance/Softaxis.Finance.Application/Softaxis.Finance.Application.csproj \
     src/Services/Finance/Softaxis.Finance.Application/
COPY Backend/src/Services/Finance/Softaxis.Finance.Infrastructure/Softaxis.Finance.Infrastructure.csproj \
     src/Services/Finance/Softaxis.Finance.Infrastructure/
COPY Backend/src/Services/Finance/Softaxis.Finance.API/Softaxis.Finance.API.csproj \
     src/Services/Finance/Softaxis.Finance.API/

COPY Backend/src/Services/CRM/Softaxis.CRM.Domain/Softaxis.CRM.Domain.csproj \
     src/Services/CRM/Softaxis.CRM.Domain/
COPY Backend/src/Services/CRM/Softaxis.CRM.Infrastructure/Softaxis.CRM.Infrastructure.csproj \
     src/Services/CRM/Softaxis.CRM.Infrastructure/
COPY Backend/src/Services/CRM/Softaxis.CRM.API/Softaxis.CRM.API.csproj \
     src/Services/CRM/Softaxis.CRM.API/

COPY Backend/src/Services/Construction/Softaxis.Construction.Domain/Softaxis.Construction.Domain.csproj \
     src/Services/Construction/Softaxis.Construction.Domain/
COPY Backend/src/Services/Construction/Softaxis.Construction.Infrastructure/Softaxis.Construction.Infrastructure.csproj \
     src/Services/Construction/Softaxis.Construction.Infrastructure/
COPY Backend/src/Services/Construction/Softaxis.Construction.API/Softaxis.Construction.API.csproj \
     src/Services/Construction/Softaxis.Construction.API/

COPY Backend/src/Services/RealEstate/Softaxis.RealEstate.Domain/Softaxis.RealEstate.Domain.csproj \
     src/Services/RealEstate/Softaxis.RealEstate.Domain/
COPY Backend/src/Services/RealEstate/Softaxis.RealEstate.Infrastructure/Softaxis.RealEstate.Infrastructure.csproj \
     src/Services/RealEstate/Softaxis.RealEstate.Infrastructure/
COPY Backend/src/Services/RealEstate/Softaxis.RealEstate.API/Softaxis.RealEstate.API.csproj \
     src/Services/RealEstate/Softaxis.RealEstate.API/

COPY Backend/src/Services/Hospitality/Softaxis.Hospitality.Domain/Softaxis.Hospitality.Domain.csproj \
     src/Services/Hospitality/Softaxis.Hospitality.Domain/
COPY Backend/src/Services/Hospitality/Softaxis.Hospitality.Infrastructure/Softaxis.Hospitality.Infrastructure.csproj \
     src/Services/Hospitality/Softaxis.Hospitality.Infrastructure/
COPY Backend/src/Services/Hospitality/Softaxis.Hospitality.API/Softaxis.Hospitality.API.csproj \
     src/Services/Hospitality/Softaxis.Hospitality.API/

COPY Backend/src/Services/Restaurant/Softaxis.Restaurant.Domain/Softaxis.Restaurant.Domain.csproj \
     src/Services/Restaurant/Softaxis.Restaurant.Domain/
COPY Backend/src/Services/Restaurant/Softaxis.Restaurant.Infrastructure/Softaxis.Restaurant.Infrastructure.csproj \
     src/Services/Restaurant/Softaxis.Restaurant.Infrastructure/
COPY Backend/src/Services/Restaurant/Softaxis.Restaurant.API/Softaxis.Restaurant.API.csproj \
     src/Services/Restaurant/Softaxis.Restaurant.API/

COPY Backend/src/Services/Recipe/Softaxis.Recipe.Domain/Softaxis.Recipe.Domain.csproj \
     src/Services/Recipe/Softaxis.Recipe.Domain/
COPY Backend/src/Services/Recipe/Softaxis.Recipe.Infrastructure/Softaxis.Recipe.Infrastructure.csproj \
     src/Services/Recipe/Softaxis.Recipe.Infrastructure/
COPY Backend/src/Services/Recipe/Softaxis.Recipe.API/Softaxis.Recipe.API.csproj \
     src/Services/Recipe/Softaxis.Recipe.API/

COPY Backend/src/Services/ProjectManagement/Softaxis.ProjectManagement.Domain/Softaxis.ProjectManagement.Domain.csproj \
     src/Services/ProjectManagement/Softaxis.ProjectManagement.Domain/
COPY Backend/src/Services/ProjectManagement/Softaxis.ProjectManagement.Application/Softaxis.ProjectManagement.Application.csproj \
     src/Services/ProjectManagement/Softaxis.ProjectManagement.Application/
COPY Backend/src/Services/ProjectManagement/Softaxis.ProjectManagement.Infrastructure/Softaxis.ProjectManagement.Infrastructure.csproj \
     src/Services/ProjectManagement/Softaxis.ProjectManagement.Infrastructure/
COPY Backend/src/Services/ProjectManagement/Softaxis.ProjectManagement.API/Softaxis.ProjectManagement.API.csproj \
     src/Services/ProjectManagement/Softaxis.ProjectManagement.API/

# Restore dependencies (cached unless csproj files change)
RUN dotnet restore src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj \
    --runtime linux-x64

# Copy all source code
COPY Backend/src/ src/

# Publish release build
RUN dotnet publish src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    --runtime linux-x64 \
    --self-contained false \
    /p:DebugType=none \
    /p:DebugSymbols=false

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# Install ICU for globalization + curl for health checks
RUN apk add --no-cache icu-libs curl tzdata \
    && cp /usr/share/zoneinfo/Asia/Dubai /etc/localtime \
    && echo "Asia/Dubai" > /etc/timezone

# Globalization support
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Production environment
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

EXPOSE 8080

# Non-root user
RUN addgroup -S vrodux && adduser -S vrodux -G vrodux \
    && chown -R vrodux:vrodux /app

USER vrodux

COPY --from=build --chown=vrodux:vrodux /app/publish .

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Softaxis.ApiGateway.dll"]
