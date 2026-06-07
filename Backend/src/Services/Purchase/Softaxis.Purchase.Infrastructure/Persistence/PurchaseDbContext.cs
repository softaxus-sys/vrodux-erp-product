using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence;

public sealed class PurchaseDbContext(DbContextOptions<PurchaseDbContext> options)
    : DbContext(options)
{
    public DbSet<Vendor>            Vendors            => Set<Vendor>();
    public DbSet<PurchaseOrder>     PurchaseOrders     => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem>  PurchaseOrderItems  => Set<PurchaseOrderItem>();
    public DbSet<PurchaseApproval>   PurchaseApprovals   => Set<PurchaseApproval>();
    public DbSet<PurchaseApprovalItem> PurchaseApprovalItems => Set<PurchaseApprovalItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("purchase");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PurchaseDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.Purchase.Domain");
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
