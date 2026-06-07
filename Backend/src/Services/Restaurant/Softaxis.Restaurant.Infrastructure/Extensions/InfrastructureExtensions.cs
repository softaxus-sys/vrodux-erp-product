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
        await RestaurantSeedData.SeedAsync(db);
    }
}
