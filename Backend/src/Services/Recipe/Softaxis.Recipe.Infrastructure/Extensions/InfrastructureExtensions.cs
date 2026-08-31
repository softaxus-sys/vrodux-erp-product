using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence.Seed;

namespace Softaxis.Recipe.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddRecipeInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<RecipeDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("RecipeDb"),
                sql => sql.MigrationsAssembly(typeof(RecipeDbContext).Assembly.FullName)));
        return services;
    }

    public static async Task MigrateAndSeedRecipeAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RecipeDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => RecipeSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await RecipeSeedData.SeedAsync(db);
    }
}
