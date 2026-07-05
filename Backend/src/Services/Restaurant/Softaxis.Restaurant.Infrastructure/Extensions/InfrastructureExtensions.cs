using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Restaurant.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Persistence.Seed;

namespace Softaxis.Restaurant.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddRestaurantInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<RestaurantDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("RestaurantDb"),
                sql => sql.MigrationsAssembly(typeof(RestaurantDbContext).Assembly.FullName)));
        return services;
    }

    public static async Task MigrateAndSeedRestaurantAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
        await db.Database.MigrateAsync();

        // One-time repair (idempotent): payment rows written by the old raw-SQL RecordPayment
        // landed with TenantId = NULL (raw SQL bypasses StampTenantId), so the tenant query
        // filter hid them from their own tenant. Stamp them from the parent order.
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE p SET p.TenantId = o.TenantId
            FROM [restaurant].[OrderPayments] p
            JOIN [restaurant].[Orders] o ON o.Id = p.OrderId
            WHERE p.TenantId IS NULL AND o.TenantId IS NOT NULL
            """);

        await RestaurantSeedData.SeedAsync(db);
    }
}
