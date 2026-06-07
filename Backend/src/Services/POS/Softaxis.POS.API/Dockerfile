FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first for layer caching
COPY src/BuildingBlocks/Softaxis.BuildingBlocks.Domain/Softaxis.BuildingBlocks.Domain.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Domain/
COPY src/BuildingBlocks/Softaxis.BuildingBlocks.Application/Softaxis.BuildingBlocks.Application.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Application/
COPY src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/Softaxis.BuildingBlocks.Infrastructure.csproj \
     src/BuildingBlocks/Softaxis.BuildingBlocks.Infrastructure/
COPY src/Services/POS/Softaxis.POS.Domain/Softaxis.POS.Domain.csproj \
     src/Services/POS/Softaxis.POS.Domain/
COPY src/Services/POS/Softaxis.POS.Application/Softaxis.POS.Application.csproj \
     src/Services/POS/Softaxis.POS.Application/
COPY src/Services/POS/Softaxis.POS.Infrastructure/Softaxis.POS.Infrastructure.csproj \
     src/Services/POS/Softaxis.POS.Infrastructure/
COPY src/Services/POS/Softaxis.POS.API/Softaxis.POS.API.csproj \
     src/Services/POS/Softaxis.POS.API/

COPY NuGet.config ./

RUN dotnet restore src/Services/POS/Softaxis.POS.API/Softaxis.POS.API.csproj --configfile NuGet.config

COPY . .

RUN dotnet publish src/Services/POS/Softaxis.POS.API/Softaxis.POS.API.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "Softaxis.POS.API.dll"]
