using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence.Configurations;

namespace Softaxis.Hospitality.Infrastructure.Persistence;

public sealed class HospitalityDbContext(DbContextOptions<HospitalityDbContext> options) : DbContext(options)
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<HousekeepingTask> HousekeepingTasks => Set<HousekeepingTask>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("hospitality");
        mb.ApplyConfigurationsFromAssembly(typeof(HospitalityConfigurations).Assembly);
        TenantIsolation.ApplyTenantId(mb, "Softaxis.Hospitality.Domain");
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
