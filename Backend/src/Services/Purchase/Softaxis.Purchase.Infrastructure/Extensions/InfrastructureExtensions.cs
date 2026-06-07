using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Purchase.Infrastructure.Persistence;
using Softaxis.Purchase.Infrastructure.Persistence.Seed;

namespace Softaxis.Purchase.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddPurchaseInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<PurchaseDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("PurchaseDb"),
                sql => sql.MigrationsAssembly(typeof(PurchaseDbContext).Assembly.FullName)));

        return services;
    }

    public static async Task MigrateAndSeedPurchaseAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PurchaseDbContext>();
        await db.Database.MigrateAsync();
        await PurchaseSeedData.SeedAsync(db);
    }
}
