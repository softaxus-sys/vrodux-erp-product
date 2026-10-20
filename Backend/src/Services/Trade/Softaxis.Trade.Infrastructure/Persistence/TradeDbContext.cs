using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Trade.Domain.Entities;

namespace Softaxis.Trade.Infrastructure.Persistence;

public sealed class TradeDbContext(DbContextOptions<TradeDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<TradeParty>        Parties    => Set<TradeParty>();
    public DbSet<Shipment>          Shipments  => Set<Shipment>();
    public DbSet<ShipmentItem>      Items      => Set<ShipmentItem>();
    public DbSet<ShipmentContainer> Containers => Set<ShipmentContainer>();
    public DbSet<ShipmentMilestone> Milestones => Set<ShipmentMilestone>();
    public DbSet<ShipmentCost>      Costs      => Set<ShipmentCost>();
    public DbSet<ShipmentPayment>   Payments   => Set<ShipmentPayment>();
    public DbSet<TradeDocument>     Documents  => Set<TradeDocument>();
    public DbSet<TradeAlertState>   AlertStates => Set<TradeAlertState>();
    public DbSet<HsDutyRate>        DutyRates   => Set<HsDutyRate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("trade");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TradeDbContext).Assembly);

        // Shadow TenantId + query filter on every table. This replaces any entity-level
        // soft-delete filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Trade.Domain");

        // A shipment number is unique per workspace among live rows.
        TenantIsolation.TenantUniqueIndex<Shipment>(modelBuilder, [nameof(Shipment.ShipmentNumber)]);
        // One alert-state row per workspace.
        TenantIsolation.TenantUniqueIndex<TradeAlertState>(modelBuilder, [], excludeSoftDeleted: false);
        // One rate per HS code per workspace, among live rows.
        TenantIsolation.TenantUniqueIndex<HsDutyRate>(modelBuilder, [nameof(HsDutyRate.HsDigits)]);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
