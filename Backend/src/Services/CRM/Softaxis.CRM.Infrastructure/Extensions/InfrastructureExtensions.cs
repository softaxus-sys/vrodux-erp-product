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
using Softaxis.CRM.Infrastructure.Integrations.Services;
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

        // ── Providers ─────────────────────────────────────────────────────────
        // No-credential inbound providers (one generic implementation, several catalog cards).
        const ProviderCapabilities inbound = ProviderCapabilities.Webhook | ProviderCapabilities.InboundKey;
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("webhook", new(
            "webhook", "Webhook API", ProviderCategory.Automation,
            "Receive leads from any service that can POST JSON to a secure inbound URL.", inbound)));
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("zapier", new(
            "zapier", "Zapier", ProviderCategory.Automation,
            "Connect 6,000+ apps — send leads to Vrodux from any Zap.", inbound)));
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("make", new(
            "make", "Make.com", ProviderCategory.Automation,
            "Automate lead capture from any Make.com scenario via webhook.", inbound)));
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("website", new(
            "website", "Website Forms", ProviderCategory.Website,
            "Drop a snippet on any website; submitted forms appear in CRM automatically.", inbound)));
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("custom-api", new(
            "custom-api", "Custom API", ProviderCategory.Custom,
            "Push leads programmatically with a per-tenant inbound key and optional HMAC signing.",
            inbound | ProviderCapabilities.ApiKey)));
        // OAuth / poll providers (Meta in C3, stubs in C5) register alongside these.

        // ── Background processing (inbox drain + retry) ───────────────────────
        services.AddHostedService<RawLeadInboxProcessor>();

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
