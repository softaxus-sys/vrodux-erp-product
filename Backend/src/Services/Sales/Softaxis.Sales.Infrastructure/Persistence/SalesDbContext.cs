using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence;

public sealed class SalesDbContext(DbContextOptions<SalesDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<Customer>          Customers          => Set<Customer>();
    public DbSet<SalesOrder>        SalesOrders        => Set<SalesOrder>();
    public DbSet<SalesOrderItem>    SalesOrderItems    => Set<SalesOrderItem>();
    public DbSet<SalesQuotation>    SalesQuotations    => Set<SalesQuotation>();
    public DbSet<SalesQuotationItem> SalesQuotationItems => Set<SalesQuotationItem>();
    public DbSet<SalesReturn>       SalesReturns       => Set<SalesReturn>();
    public DbSet<SalesReturnItem>   SalesReturnItems   => Set<SalesReturnItem>();
    public DbSet<DeliveryChallan>     DeliveryChallans     => Set<DeliveryChallan>();
    public DbSet<DeliveryChallanItem> DeliveryChallanItems => Set<DeliveryChallanItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("sales");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SalesDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Sales.Domain");

        // Document numbers are unique PER TENANT and only among live rows.
        TenantIsolation.TenantUniqueIndex<SalesOrder>(modelBuilder, [nameof(SalesOrder.OrderNumber)]);
        TenantIsolation.TenantUniqueIndex<SalesQuotation>(modelBuilder, [nameof(SalesQuotation.QuotationNumber)]);
        TenantIsolation.TenantUniqueIndex<DeliveryChallan>(modelBuilder, [nameof(DeliveryChallan.ChallanNumber)]);
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
