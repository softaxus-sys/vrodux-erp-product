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
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
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
        // ── Meta (Facebook / Instagram Lead Ads) — OAuth + webhook + poll ─────
        services.Configure<MetaOptions>(configuration.GetSection(MetaOptions.Section));
        services.AddHttpClient("meta");
        services.AddSingleton<MetaGraphClient>();
        services.AddSingleton<ILeadProvider, MetaLeadProvider>();

        // ── Planned providers (catalog "Coming soon" cards) ───────────────────
        // Each becomes real by replacing its stub with a concrete provider — no other change.
        const ProviderCapabilities oauthPoll = ProviderCapabilities.OAuth | ProviderCapabilities.PollSync;
        AddStub(services, "google-ads",      "Google Ads Lead Forms", ProviderCategory.SocialAds,  "Capture leads from Google Ads lead form extensions.", oauthPoll);
        AddStub(services, "google-forms",    "Google Forms",          ProviderCategory.Forms,      "Sync responses from your Google Forms into CRM.", oauthPoll);
        AddStub(services, "google-sheets",   "Google Sheets",         ProviderCategory.Forms,      "Turn new spreadsheet rows into CRM leads.", oauthPoll);
        AddStub(services, "linkedin",        "LinkedIn Lead Gen Forms",ProviderCategory.SocialAds, "Import leads from LinkedIn Lead Gen Forms.", oauthPoll);
        AddStub(services, "tiktok",          "TikTok Lead Generation",ProviderCategory.SocialAds,  "Capture leads from TikTok instant forms.", oauthPoll);
        AddStub(services, "whatsapp",        "WhatsApp Business",     ProviderCategory.Messaging,  "Receive enquiries from WhatsApp Business.", ProviderCapabilities.Webhook);
        AddStub(services, "microsoft-forms", "Microsoft Forms",       ProviderCategory.Forms,      "Sync responses from Microsoft Forms.", oauthPoll);
        AddStub(services, "calendly",        "Calendly",              ProviderCategory.Forms,      "Create leads from new Calendly bookings.", ProviderCapabilities.Webhook);
        AddStub(services, "jotform",         "Jotform",               ProviderCategory.Forms,      "Capture Jotform submissions as leads.", ProviderCapabilities.Webhook);
        AddStub(services, "typeform",        "Typeform",              ProviderCategory.Forms,      "Capture Typeform responses as leads.", ProviderCapabilities.Webhook);
        AddStub(services, "csv",             "CSV Import",            ProviderCategory.Import,      "Bulk-import leads from a CSV file.", ProviderCapabilities.ManualImport);

        // ── Background processing (inbox drain + retry) ───────────────────────
        services.AddHostedService<RawLeadInboxProcessor>();

        return services;
    }

    private static void AddStub(IServiceCollection services, string key, string name, string category,
        string description, ProviderCapabilities planned) =>
        services.AddSingleton<ILeadProvider>(_ => new StubLeadProvider(key, name, category, description, planned));

    public static async Task MigrateAndSeedCrmAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        await db.Database.MigrateAsync();

        // Demo CRM data (leads/customers/deals with no tenant) is dev scaffolding only — never
        // seed it into a real (Production) deployment. It is created at startup with no tenant
        // context, so it lands with TenantId = NULL and, on a build that predates CRM tenant
        // isolation, leaks across every tenant's Leads/Customers/Pipeline. Gated like the POS demo seed.
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
        if (!string.Equals(env, "Production", StringComparison.OrdinalIgnoreCase))
            await CrmSeedData.SeedAsync(db);
    }
}
