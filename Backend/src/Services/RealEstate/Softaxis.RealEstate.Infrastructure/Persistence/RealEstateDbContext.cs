using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence.Configurations;

namespace Softaxis.RealEstate.Infrastructure.Persistence;

public sealed class RealEstateDbContext(DbContextOptions<RealEstateDbContext> options) : DbContext(options), ITenantAmbientContext
{
    // NOTE: this service's entities already have a "TenantId" meaning the RENTER/lessee,
    // so SaaS-tenant isolation uses a distinct "OwnerTenantId" column.
    public const string OwnerTenant = "OwnerTenantId";

    public DbSet<Property> Properties => Set<Property>();
    public DbSet<PropertyUnit> PropertyUnits => Set<PropertyUnit>();
    public DbSet<PropertyImage> PropertyImages => Set<PropertyImage>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<LeaseContract> LeaseContracts => Set<LeaseContract>();
    public DbSet<Broker> Brokers => Set<Broker>();
    public DbSet<SiteVisit> SiteVisits => Set<SiteVisit>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<RentInstallment> RentInstallments => Set<RentInstallment>();
    public DbSet<RentAlertSettings> RentAlertSettings => Set<RentAlertSettings>();
    public DbSet<RentAlertLog> RentAlertLogs => Set<RentAlertLog>();

    /// <summary>Read-only view of identity.tenants — see <see cref="TenantLookup"/>.</summary>
    public DbSet<TenantLookup> TenantLookups => Set<TenantLookup>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("real_estate");
        mb.ApplyConfigurationsFromAssembly(typeof(RealEstateConfigurations).Assembly);
        SalesLifecycleConfig.Apply(mb);
        TenantIsolation.ApplyTenantId(mb, this, "Softaxis.RealEstate.Domain", OwnerTenant);

        // MUST come after ApplyTenantId — the tenant column is a shadow property that does not
        // exist before it, so this cannot live in an IEntityTypeConfiguration.
        //
        // This index IS the reminder idempotency guarantee. The sweep re-evaluates every open
        // installment daily; without a unique constraint on what has already gone out, an
        // interrupted run or a second worker re-sends the same notice.
        TenantIsolation.TenantUniqueIndex<RentAlertLog>(
            mb,
            [nameof(RentAlertLog.ContractId), nameof(RentAlertLog.InstallmentId),
             nameof(RentAlertLog.Kind), nameof(RentAlertLog.OffsetKey)],
            excludeSoftDeleted: false,
            column: OwnerTenant);

        // One settings row per workspace.
        TenantIsolation.TenantUniqueIndex<RentAlertSettings>(
            mb, [], excludeSoftDeleted: false, column: OwnerTenant);

        // Owned by Identity: mapped for reading only, and excluded from migrations so this
        // service never tries to create or alter that table.
        mb.Entity<TenantLookup>(b =>
        {
            b.ToTable("tenants", "identity", t => t.ExcludeFromMigrations());
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).ValueGeneratedNever();
            b.Property(x => x.Slug).HasMaxLength(100);
            b.Property(x => x.Name).HasMaxLength(200);
            b.Property(x => x.Status).HasMaxLength(30);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker, OwnerTenant);
        return base.SaveChangesAsync(cancellationToken);
    }
}
