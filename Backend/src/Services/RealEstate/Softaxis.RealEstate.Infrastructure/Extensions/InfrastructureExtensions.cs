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
using Softaxis.RealEstate.Infrastructure.Qasro;
using Softaxis.RealEstate.Infrastructure.Security;

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

        // Qasro (qasro.com) — real OAuth against Qasro's own login/signup + agency-approval gate,
        // same shape as the Meta and Google OAuth integrations elsewhere in this codebase.
        services.Configure<QasroOptions>(configuration.GetSection(QasroOptions.Section));
        // AllowAutoRedirect disabled deliberately: HttpClient (like every conforming HTTP client)
        // strips the Authorization header when a redirect changes host — e.g. Vercel's apex→www
        // canonical redirect. Following it silently turned a config mistake (ApiBaseUrl pointing at
        // the non-canonical host) into a confusing 401 from the destination instead of an obvious
        // "this call got redirected" error. QasroClient now surfaces the redirect explicitly instead.
        services.AddHttpClient("qasro")
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        services.AddScoped<IQasroClient, QasroClient>();
        services.AddScoped<ISecretProtector, DataProtectionSecretProtector>();

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
