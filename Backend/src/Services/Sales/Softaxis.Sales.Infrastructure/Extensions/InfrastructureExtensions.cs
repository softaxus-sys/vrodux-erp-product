using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Sales.Infrastructure.Persistence;
using Softaxis.Sales.Infrastructure.Persistence.Seed;

namespace Softaxis.Sales.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddSalesInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<SalesDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("SalesDb"),
                sql => sql.MigrationsAssembly(typeof(SalesDbContext).Assembly.FullName)));

        return services;
    }

    public static async Task MigrateAndSeedSalesAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        await db.Database.MigrateAsync();
        await SalesSeedData.SeedAsync(db);
    }
}
