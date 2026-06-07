using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Persistence.Seed;

namespace Softaxis.RealEstate.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddRealEstateInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<RealEstateDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("RealEstateDb"),
                sql => sql.MigrationsAssembly(typeof(RealEstateDbContext).Assembly.FullName)));
        return services;
    }

    public static async Task MigrateAndSeedRealEstateAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RealEstateDbContext>();
        await db.Database.MigrateAsync();
        await RealEstateSeedData.SeedAsync(db);
    }
}
