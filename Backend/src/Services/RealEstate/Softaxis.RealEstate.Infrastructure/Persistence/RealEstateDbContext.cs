using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence.Configurations;

namespace Softaxis.RealEstate.Infrastructure.Persistence;

public sealed class RealEstateDbContext(DbContextOptions<RealEstateDbContext> options) : DbContext(options), ITenantAmbientContext
{
    // NOTE: this service's entities already have a "TenantId" meaning the RENTER/lessee,
    // so SaaS-tenant isolation uses a distinct "OwnerTenantId" column.
    private const string OwnerTenant = "OwnerTenantId";

    public DbSet<Property> Properties => Set<Property>();
    public DbSet<PropertyUnit> PropertyUnits => Set<PropertyUnit>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<LeaseContract> LeaseContracts => Set<LeaseContract>();
    public DbSet<Broker> Brokers => Set<Broker>();
    public DbSet<SiteVisit> SiteVisits => Set<SiteVisit>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("real_estate");
        mb.ApplyConfigurationsFromAssembly(typeof(RealEstateConfigurations).Assembly);
        SalesLifecycleConfig.Apply(mb);
        TenantIsolation.ApplyTenantId(mb, this, "Softaxis.RealEstate.Domain", OwnerTenant);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker, OwnerTenant);
        return base.SaveChangesAsync(cancellationToken);
    }
}
