# ============================================================================
# Vrodux ERP — Production API Dockerfile
# Multi-stage build for .NET 10 Modular Monolith (API Gateway)
# ============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Install ICU for globalization support
RUN apk add --no-cache icu-libs

# Copy everything and restore
COPY Backend/ .
RUN dotnet restore src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj

# Publish release build
RUN dotnet publish src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
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
