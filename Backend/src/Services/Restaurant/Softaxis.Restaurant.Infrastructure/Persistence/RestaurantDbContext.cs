using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence.Configurations;

namespace Softaxis.Restaurant.Infrastructure.Persistence;

public sealed class RestaurantDbContext(DbContextOptions<RestaurantDbContext> options) : DbContext(options), ITenantAmbientContext
{
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<MenuCategory> MenuCategories => Set<MenuCategory>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();
    public DbSet<Reservation> Reservations => Set<Reservation>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("restaurant");
        mb.ApplyConfigurationsFromAssembly(typeof(RestaurantConfigurations).Assembly);
        TenantIsolation.ApplyTenantId(mb, this, "Softaxis.Restaurant.Domain");
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
