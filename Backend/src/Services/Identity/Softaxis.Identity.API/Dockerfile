# ── Build stage ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution + project files for layer caching
COPY Softaxis.ERP.sln ./
COPY src/BuildingBlocks/Softaxis.BuildingBlocks.Domain/Softaxis.BuildingBlocks.Domain.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Domain/
COPY src/BuildingBlocks/Softaxis.BuildingBlocks.Application/Softaxis.BuildingBlocks.Application.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Application/
COPY src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/Softaxis.BuildingBlocks.Infrastructure.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/
COPY src/Services/Identity/Softaxis.Identity.Domain/Softaxis.Identity.Domain.csproj \
     src/Services/Identity/Softaxis.Identity.Domain/
COPY src/Services/Identity/Softaxis.Identity.Application/Softaxis.Identity.Application.csproj \
     src/Services/Identity/Softaxis.Identity.Application/
COPY src/Services/Identity/Softaxis.Identity.Infrastructure/Softaxis.Identity.Infrastructure.csproj \
     src/Services/Identity/Softaxis.Identity.Infrastructure/
COPY src/Services/Identity/Softaxis.Identity.API/Softaxis.Identity.API.csproj \
     src/Services/Identity/Softaxis.Identity.API/
COPY NuGet.config ./

RUN dotnet restore src/Services/Identity/Softaxis.Identity.API/Softaxis.Identity.API.csproj

# Copy source and publish
COPY . .
RUN dotnet publish src/Services/Identity/Softaxis.Identity.API/Softaxis.Identity.API.csproj \
    -c Release -o /app/publish --no-restore

# ── Runtime stage ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "Softaxis.Identity.API.dll"]
