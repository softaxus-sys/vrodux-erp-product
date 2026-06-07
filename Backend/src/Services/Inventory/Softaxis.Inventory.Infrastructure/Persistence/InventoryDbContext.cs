using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence;

public sealed class InventoryDbContext(DbContextOptions<InventoryDbContext> options)
    : DbContext(options)
{
    public DbSet<Product>         Products         => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<StockMovement>   StockMovements   => Set<StockMovement>();
    public DbSet<ProductStock>    ProductStocks    => Set<ProductStock>();
    public DbSet<ProductBatch>    ProductBatches   => Set<ProductBatch>();
    public DbSet<Warehouse>       Warehouses       => Set<Warehouse>();
    public DbSet<Brand>           Brands           => Set<Brand>();
    public DbSet<UnitOfMeasure>   UnitsOfMeasure   => Set<UnitOfMeasure>();
    public DbSet<StockTransfer>   StockTransfers   => Set<StockTransfer>();
    public DbSet<StockTransferItem> StockTransferItems => Set<StockTransferItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("inventory");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(InventoryDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.Inventory.Domain");
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Properties.Any(p => p.Metadata.Name == "CreatedAt"))
                    entry.Property("CreatedAt").CurrentValue = now;
            }
            if (entry.State == EntityState.Modified)
            {
                if (entry.Properties.Any(p => p.Metadata.Name == "UpdatedAt"))
                    entry.Property("UpdatedAt").CurrentValue = now;
            }
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
