using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.Hospitality.Application;
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

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyReference).Assembly,         // Application
                typeof(InfrastructureExtensions).Assembly); // Infrastructure

            // Pipeline order matters: Logging wraps Validation wraps Handler
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(AssemblyReference).Assembly);

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
