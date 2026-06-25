# ── Build stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# The gateway project references every module's API/Infrastructure project,
# so a single restore of the gateway csproj pulls in the whole graph.
COPY . .

RUN dotnet restore src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj

RUN dotnet publish src/ApiGateway/Softaxis.ApiGateway/Softaxis.ApiGateway.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Docker
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

COPY --from=build /app/publish .

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Softaxis.ApiGateway.dll"]
