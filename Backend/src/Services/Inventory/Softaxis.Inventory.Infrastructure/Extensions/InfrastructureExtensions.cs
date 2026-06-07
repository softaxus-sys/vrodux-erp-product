using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Domain.Repositories;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Inventory.Infrastructure.Persistence.Repositories;
using Softaxis.Inventory.Infrastructure.Persistence.Seed;
using Softaxis.Inventory.Infrastructure.Services;

namespace Softaxis.Inventory.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddInventoryInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<InventoryDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("InventoryDb"),
                sql => sql.MigrationsAssembly(typeof(InventoryDbContext).Assembly.FullName)));

        // ── Repositories ──────────────────────────────────────────────────────
        services.AddScoped<IProductRepository,       ProductRepository>();
        services.AddScoped<ICategoryRepository,      CategoryRepository>();
        services.AddScoped<IWarehouseRepository,     WarehouseRepository>();
        services.AddScoped<IStockMovementRepository, StockMovementRepository>();
        services.AddScoped<IBrandRepository,         BrandRepository>();
        services.AddScoped<IUnitOfMeasureRepository, UnitOfMeasureRepository>();
        services.AddScoped<IInventoryUnitOfWork,      InventoryUnitOfWork>();
        services.AddScoped<IInventoryReportService,  InventoryReportService>();
        services.AddScoped<IProductReadService,      ProductReadService>();

        return services;
    }

    public static async Task MigrateAndSeedInventoryAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
        await db.Database.MigrateAsync();
        await InventorySeedData.SeedAsync(db);
    }
}
