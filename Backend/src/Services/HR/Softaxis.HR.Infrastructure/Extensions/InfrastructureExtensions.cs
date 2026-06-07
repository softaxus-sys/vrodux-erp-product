using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.HR.Infrastructure.Persistence;
using Softaxis.HR.Infrastructure.Persistence.Seed;

namespace Softaxis.HR.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddHrInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<HrDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("HrDb"),
                sql => sql.MigrationsAssembly(typeof(HrDbContext).Assembly.FullName)));

        return services;
    }

    public static async Task MigrateAndSeedHrAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrDbContext>();
        await db.Database.MigrateAsync();
        await HrSeedData.SeedAsync(db);
    }
}
