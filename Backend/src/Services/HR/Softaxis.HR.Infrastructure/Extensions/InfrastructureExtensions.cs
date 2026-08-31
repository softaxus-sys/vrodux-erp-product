using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.HR.Application;
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

    public static async Task MigrateAndSeedHrAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HrDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => HrSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await HrSeedData.SeedAsync(db);
    }
}
