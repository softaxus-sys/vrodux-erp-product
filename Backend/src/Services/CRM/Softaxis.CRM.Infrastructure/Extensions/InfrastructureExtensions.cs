using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.CRM.Application;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers;
using Softaxis.CRM.Infrastructure.Integrations.Security;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Persistence.Seed;

namespace Softaxis.CRM.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddCrmInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<CrmDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("CrmDb"),
                sql => sql.MigrationsAssembly(typeof(CrmDbContext).Assembly.FullName)));

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

        // ── Integration platform (lead sources) ──────────────────────────────
        // Secret encryption over ASP.NET Core Data Protection (host calls AddDataProtection()).
        services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();
        // Provider registry auto-discovers every ILeadProvider registered below.
        services.AddSingleton<ILeadProviderRegistry, LeadProviderRegistry>();
        // The single intake pipeline (mapping → dedupe → create → routing → notification).
        services.AddScoped<ILeadIntakeService, LeadIntakeService>();
        // Providers are registered here as they come online (Webhook/Meta/… in later phases):
        //   services.AddSingleton<ILeadProvider, MetaLeadProvider>();

        return services;
    }

    public static async Task MigrateAndSeedCrmAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        await db.Database.MigrateAsync();
        await CrmSeedData.SeedAsync(db);
    }
}
