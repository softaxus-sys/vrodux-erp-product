using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence;

public sealed class SalesDbContext(DbContextOptions<SalesDbContext> options)
    : DbContext(options)
{
    public DbSet<Customer>          Customers          => Set<Customer>();
    public DbSet<SalesOrder>        SalesOrders        => Set<SalesOrder>();
    public DbSet<SalesOrderItem>    SalesOrderItems    => Set<SalesOrderItem>();
    public DbSet<SalesQuotation>    SalesQuotations    => Set<SalesQuotation>();
    public DbSet<SalesQuotationItem> SalesQuotationItems => Set<SalesQuotationItem>();
    public DbSet<SalesReturn>       SalesReturns       => Set<SalesReturn>();
    public DbSet<SalesReturnItem>   SalesReturnItems   => Set<SalesReturnItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("sales");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SalesDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.Sales.Domain");
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
