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

# "Docker" environment triggers the auto-migrate/seed block in Program.cs
ENV ASPNETCORE_ENVIRONMENT=Docker
EXPOSE 8080

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

COPY --from=build /app/publish .

# Render (and similar PaaS) inject $PORT at runtime and require the app to
# bind to it; default to 8080 for local docker-compose use where PORT is unset.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet Softaxis.ApiGateway.dll"]
