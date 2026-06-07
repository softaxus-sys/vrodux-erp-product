using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Construction.Infrastructure.Persistence;
using Softaxis.Construction.Infrastructure.Persistence.Seed;

namespace Softaxis.Construction.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddConstructionInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ConstructionDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("ConstructionDb"),
                sql => sql.MigrationsAssembly(typeof(ConstructionDbContext).Assembly.FullName)));
        return services;
    }

    public static async Task MigrateAndSeedConstructionAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConstructionDbContext>();
        await db.Database.MigrateAsync();
        await ConstructionSeedData.SeedAsync(db);
    }
}
