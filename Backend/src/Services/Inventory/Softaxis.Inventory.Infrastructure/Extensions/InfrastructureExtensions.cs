using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
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
        services.AddScoped<IProductStockRepository,  ProductStockRepository>();
        services.AddScoped<IStockTransferRepository, StockTransferRepository>();
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
        await db.Database.MigrateTolerantOfLockReleaseAsync();

        // One-time repair (idempotent): rows written by the old raw-SQL POS cross-schema
        // sale/refund path landed with TenantId = NULL (raw SQL bypasses StampTenantId), so
        // the tenant query filter hid them from their own tenant. Stamp from the owning product.
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE m SET m.TenantId = p.TenantId
            FROM [inventory].[stock_movements] m
            JOIN [inventory].[products] p ON p.Id = m.ProductId
            WHERE m.TenantId IS NULL AND p.TenantId IS NOT NULL
            """);
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE s SET s.TenantId = p.TenantId
            FROM [inventory].[product_stock] s
            JOIN [inventory].[products] p ON p.Id = s.ProductId
            WHERE s.TenantId IS NULL AND p.TenantId IS NOT NULL
            """);

        // One-time consolidation (idempotent): Product Categories is the single category list.
        // Copy categories that were created under the retired "POS Categories" page, keeping
        // their Id so POS products stay linked. A name the workspace already has is skipped
        // rather than duplicated. Never allowed to stop startup.
        try
        {
            await db.Database.ExecuteSqlRawAsync("""
                IF OBJECT_ID(N'[pos].[product_categories]') IS NOT NULL
                INSERT INTO [inventory].[product_categories]
                    (Id, Name, Description, IsActive, CreatedAt, IsDeleted, TenantId)
                SELECT pc.Id, pc.Name, pc.Description, pc.IsActive, pc.CreatedAt, 0, pc.TenantId
                FROM [pos].[product_categories] pc
                WHERE pc.IsDeleted = 0
                  AND pc.TenantId IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM [inventory].[product_categories] ic WHERE ic.Id = pc.Id)
                  AND NOT EXISTS (SELECT 1 FROM [inventory].[product_categories] ic
                                  WHERE ic.TenantId = pc.TenantId AND ic.IsDeleted = 0 AND ic.Name = pc.Name)
                """);
        }
        catch
        {
            // Best-effort: categories can still be recreated in Master Data.
        }

        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => InventorySeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await InventorySeedData.SeedAsync(db);
    }
}
