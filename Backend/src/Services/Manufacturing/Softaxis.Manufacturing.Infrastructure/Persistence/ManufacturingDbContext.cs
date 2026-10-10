using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Manufacturing.Domain.Entities;

namespace Softaxis.Manufacturing.Infrastructure.Persistence;

public sealed class ManufacturingDbContext(DbContextOptions<ManufacturingDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<BillOfMaterials>          Boms                      => Set<BillOfMaterials>();
    public DbSet<BomLine>                  BomLines                  => Set<BomLine>();
    public DbSet<ProductionOrder>          ProductionOrders          => Set<ProductionOrder>();
    public DbSet<ProductionOrderComponent> ProductionOrderComponents => Set<ProductionOrderComponent>();
    public DbSet<WorkCentre>               WorkCentres               => Set<WorkCentre>();
    public DbSet<BomOperation>             BomOperations             => Set<BomOperation>();
    public DbSet<ProductionOrderOperation> ProductionOrderOperations => Set<ProductionOrderOperation>();
    public DbSet<ProductionOrderOutput>    ProductionOrderOutputs    => Set<ProductionOrderOutput>();
    public DbSet<ProductionMaterialIssue>  ProductionMaterialIssues  => Set<ProductionMaterialIssue>();
    public DbSet<BomByProduct>             BomByProducts             => Set<BomByProduct>();
    public DbSet<ManufacturingAlertState>  AlertStates               => Set<ManufacturingAlertState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("manufacturing");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ManufacturingDbContext).Assembly);

        // Shadow TenantId + query filter on every table. This replaces any entity-level
        // soft-delete filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Manufacturing.Domain");

        // Document numbers are unique per tenant, among live rows only.
        TenantIsolation.TenantUniqueIndex<BillOfMaterials>(modelBuilder, [nameof(BillOfMaterials.BomNumber)]);
        TenantIsolation.TenantUniqueIndex<ProductionOrder>(modelBuilder, [nameof(ProductionOrder.OrderNumber)]);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
