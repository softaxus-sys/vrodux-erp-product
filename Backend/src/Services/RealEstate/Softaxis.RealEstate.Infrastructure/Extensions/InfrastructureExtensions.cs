using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.RealEstate.Application;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Infrastructure.Services;
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

        // Rent + expiry reminders. The hosted service does the nightly sweep; the sender is shared
        // with the "run now" endpoint so both decide what to send the same way.
        services.AddScoped<IRealEstateEmailService, SmtpRealEstateEmailService>();
        services.AddScoped<IRentAlertSender, RentAlertSender>();
        services.AddHostedService<RentAlertBackgroundService>();

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(AssemblyReference).Assembly);

        return services;
    }

    public static async Task MigrateAndSeedRealEstateAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RealEstateDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => RealEstateSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await RealEstateSeedData.SeedAsync(db);
    }
}
