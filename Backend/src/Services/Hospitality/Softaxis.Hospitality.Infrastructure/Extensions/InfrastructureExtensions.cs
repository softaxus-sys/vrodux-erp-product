using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Hospitality.Infrastructure.Persistence;
using Softaxis.Hospitality.Infrastructure.Persistence.Seed;

namespace Softaxis.Hospitality.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddHospitalityInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<HospitalityDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("HospitalityDb"),
                sql => sql.MigrationsAssembly(typeof(HospitalityDbContext).Assembly.FullName)));
        return services;
    }

    public static async Task MigrateAndSeedHospitalityAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HospitalityDbContext>();
        await db.Database.MigrateAsync();
        await HospitalitySeedData.SeedAsync(db);
    }
}
