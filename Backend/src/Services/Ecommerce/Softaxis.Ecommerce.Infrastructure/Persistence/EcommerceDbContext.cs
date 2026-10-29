using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Ecommerce.Domain.Entities;

namespace Softaxis.Ecommerce.Infrastructure.Persistence;

public sealed class EcommerceDbContext(DbContextOptions<EcommerceDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<SalesChannel>          Channels        => Set<SalesChannel>();
    public DbSet<ChannelListing>        Listings        => Set<ChannelListing>();
    public DbSet<ChannelListingVariant> ListingVariants => Set<ChannelListingVariant>();
    public DbSet<ChannelOrder>          Orders          => Set<ChannelOrder>();
    public DbSet<ChannelOrderLine>      OrderLines      => Set<ChannelOrderLine>();

    // The workspace's own store
    public DbSet<Store>                 Stores          => Set<Store>();
    public DbSet<StorePage>             Pages           => Set<StorePage>();
    public DbSet<StoreAsset>            Assets          => Set<StoreAsset>();
    public DbSet<StoreCollection>       Collections     => Set<StoreCollection>();
    public DbSet<ShippingZone>          ShippingZones   => Set<ShippingZone>();
    public DbSet<DiscountCode>          DiscountCodes   => Set<DiscountCode>();
    public DbSet<StoreCustomer>         Customers       => Set<StoreCustomer>();
    public DbSet<StoreCustomerAddress>  CustomerAddresses => Set<StoreCustomerAddress>();
    public DbSet<StoreOrder>            StoreOrders     => Set<StoreOrder>();
    public DbSet<StoreOrderLine>        StoreOrderLines => Set<StoreOrderLine>();
    public DbSet<StoreOrderEvent>       StoreOrderEvents => Set<StoreOrderEvent>();
    /// <summary>Identity's tenants table, read-only: an anonymous shopper's request has no tenant until the address says which.</summary>
    public DbSet<TenantLookup>          TenantLookups   => Set<TenantLookup>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("ecommerce");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(EcommerceDbContext).Assembly);

        // Identity owns this table; outside the Ecommerce namespace on purpose so it gets no tenant filter.
        modelBuilder.Entity<TenantLookup>(b =>
        {
            b.ToTable("tenants", "identity", t => t.ExcludeFromMigrations());
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).ValueGeneratedNever();
        });

        // Shadow TenantId + query filter on every table. This replaces any entity-level soft-delete
        // filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Ecommerce.Domain");

        // One order per store order; one listing per (store, Inventory listing); one shop per address — among live rows.
        TenantIsolation.TenantUniqueIndex<ChannelOrder>(modelBuilder, [nameof(ChannelOrder.ChannelId), nameof(ChannelOrder.ExternalId)]);
        TenantIsolation.TenantUniqueIndex<ChannelListing>(modelBuilder, [nameof(ChannelListing.ChannelId), nameof(ChannelListing.TemplateId)]);
        TenantIsolation.TenantUniqueIndex<SalesChannel>(modelBuilder, [nameof(SalesChannel.Kind), nameof(SalesChannel.ShopDomain)]);

        // One store per workspace; one order number, discount code, collection / page address and customer email each.
        TenantIsolation.TenantUniqueIndex<Store>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<StoreOrder>(modelBuilder, [nameof(StoreOrder.Seq)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<DiscountCode>(modelBuilder, [nameof(DiscountCode.Code)]);
        TenantIsolation.TenantUniqueIndex<StoreCollection>(modelBuilder, [nameof(StoreCollection.Slug)]);
        TenantIsolation.TenantUniqueIndex<StorePage>(modelBuilder, [nameof(StorePage.Slug)]);
        TenantIsolation.TenantUniqueIndex<StoreCustomer>(modelBuilder, [nameof(StoreCustomer.Email)]);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}

public sealed class EcommerceDbContextFactory : Microsoft.EntityFrameworkCore.Design.IDesignTimeDbContextFactory<EcommerceDbContext>
{
    /// <summary>Design-time only (`dotnet ef`); the service runs hosted inside the ApiGateway.</summary>
    public EcommerceDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<EcommerceDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                ?? "Server=(localdb)\\MSSQLLocalDB;Database=SoftaxisErpDb;Integrated Security=true;TrustServerCertificate=True;MultipleActiveResultSets=True;")
            .Options;

        return new EcommerceDbContext(options);
    }
}
