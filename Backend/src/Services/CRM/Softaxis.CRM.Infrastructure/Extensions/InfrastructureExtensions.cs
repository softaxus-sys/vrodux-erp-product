using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
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

        // ── Role-based lead access scoping (full vs assigned-only) ───────────
        services.AddScoped<Services.ILeadAccessGuard, Services.LeadAccessGuard>();

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

        // ── Calendly — inbound webhook (invitee.created → lead) ───────────────
        services.AddSingleton<ILeadProvider, CalendlyLeadProvider>();

        // ── Property Finder — real-estate portal listing enquiries (inbound webhook) ──
        // Buyer/tenant enquiries (email/call/WhatsApp) POSTed to the inbound URL become leads,
        // with the property, reference, price, offering type and message attached.
        services.AddSingleton<ILeadProvider, PropertyFinderLeadProvider>();

        // ── Google Forms / Google Sheets — inbound webhook via Apps Script ────
        // A one-time Apps Script the tenant pastes into their Form/Sheet POSTs each new
        // response/row (as flat JSON) to the integration's inbound URL. GenericInboundProvider's
        // field auto-detection maps name/email/phone/etc. — no Google OAuth app required.
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("google-forms", new(
            "google-forms", "Google Forms", ProviderCategory.Forms,
            "Sync responses from your Google Forms into CRM via a one-time Apps Script.", inbound)));
        services.AddSingleton<ILeadProvider>(_ => new GenericInboundProvider("google-sheets", new(
            "google-sheets", "Google Sheets", ProviderCategory.Forms,
            "Turn new spreadsheet rows into CRM leads via a one-time Apps Script.", inbound)));

        // ── CSV / Excel — manual file upload (parsed client-side → bulk endpoint) ──
        services.AddSingleton<ILeadProvider>(_ => new ManualImportProvider(
            "csv", "CSV / Excel Import", "Bulk-import leads from a CSV or Excel file."));

        // ── Planned providers (catalog "Coming soon" cards) ───────────────────
        // Each becomes real by replacing its stub with a concrete provider — no other change.
        const ProviderCapabilities oauthPoll = ProviderCapabilities.OAuth | ProviderCapabilities.PollSync;
        AddStub(services, "google-ads",      "Google Ads Lead Forms", ProviderCategory.SocialAds,  "Capture leads from Google Ads lead form extensions.", oauthPoll);
        AddStub(services, "linkedin",        "LinkedIn Lead Gen Forms",ProviderCategory.SocialAds, "Import leads from LinkedIn Lead Gen Forms.", oauthPoll);
        AddStub(services, "tiktok",          "TikTok Lead Generation",ProviderCategory.SocialAds,  "Capture leads from TikTok instant forms.", oauthPoll);
        AddStub(services, "whatsapp",        "WhatsApp Business",     ProviderCategory.Messaging,  "Receive enquiries from WhatsApp Business.", ProviderCapabilities.Webhook);
        AddStub(services, "microsoft-forms", "Microsoft Forms",       ProviderCategory.Forms,      "Sync responses from Microsoft Forms.", oauthPoll);
        AddStub(services, "jotform",         "Jotform",               ProviderCategory.Forms,      "Capture Jotform submissions as leads.", ProviderCapabilities.Webhook);
        AddStub(services, "typeform",        "Typeform",              ProviderCategory.Forms,      "Capture Typeform responses as leads.", ProviderCapabilities.Webhook);

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

        // Backfill value + score for existing leads — can be heavy on a large lead table, so run it in
        // the background (own scope) rather than blocking startup readiness / the deploy health check.
        _ = Task.Run(() => RecomputeLeadValueAndScoreInBackgroundAsync(services));

        // Demo CRM data (leads/customers/deals with no tenant) is dev scaffolding only. The old
        // ASPNETCORE_ENVIRONMENT != "Production" gate was ineffective — prod runs as "Docker" — so
        // it seeded into real deployments. Now gated by the explicit Seeding:DemoData flag (off by
        // default; on only in local dev). Real/trial/new tenants get no demo data.
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => CrmSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await CrmSeedData.SeedAsync(db);
    }

    // Requirement fields that may have been captured under a custom source field name and landed in
    // the lead's CustomFields (Form Responses) instead of being promoted. Keyed by normalized synonym.
    private static readonly (string Target, string[] Keys)[] RequirementSynonyms =
    [
        ("budget",       ["budget", "budgetrange", "yourbudget", "pricerange", "estimatedbudget", "price", "investment", "investmentamount"]),
        ("timeframe",    ["timeframe", "timeline", "whentobuy", "whenlookingtobuy", "whenplanningtobuy", "purchasetimeline", "buyingtimeline", "whenplanningtoinvest", "movein", "movindate", "urgency", "whenareyouplanningtobuy"]),
        ("interestedin", ["interestedin", "interest", "interests", "lookingfor", "productinterest", "serviceinterest", "propertytype", "unittype"]),
        ("whatsapp",     ["whatsapp", "whatsappnumber", "wanumber", "whatsappno"]),
        ("message",      ["message", "yourmessage", "custommessage", "enquiry", "inquiry", "additionalinfo", "details", "comments"]),
    ];

    private static string NormalizeKey(string s)
    {
        Span<char> buf = stackalloc char[s.Length];
        var n = 0;
        foreach (var c in s) if (char.IsLetterOrDigit(c)) buf[n++] = char.ToLowerInvariant(c);
        return new string(buf[..n]);
    }

    private static string? PickFromCustomFields(IReadOnlyDictionary<string, string>? custom, string[] keys)
    {
        if (custom is null || custom.Count == 0) return null;
        foreach (var (k, v) in custom)
            if (!string.IsNullOrWhiteSpace(v) && keys.Contains(NormalizeKey(k)))
                return v;
        return null;
    }

    /// <summary>
    /// Idempotent backfill / repair for leads created before (or captured without) proper field
    /// mapping. For each affected lead it (1) recovers budget/timeframe/interest/whatsapp/message
    /// that landed in CustomFields under a custom field name, (2) derives the pipeline value from the
    /// budget — forcing a re-derive when the existing value is a bad tiny legacy value (&lt; 1000, the
    /// "50" bug), and (3) recomputes the score. Targets Score = 0 or EstimatedValue &lt; 1000 leads,
    /// so already-healthy leads are untouched; writes are minimal thanks to the idempotent setters.
    /// Runs across all tenants (no ambient tenant at startup) and is best-effort — a failure must
    /// never crash-loop startup.
    /// </summary>
    /// <summary>Runs the value/score backfill on a fresh scope off the startup path (fire-and-forget).
    /// Fully guarded so an unobserved background failure can never surface.</summary>
    private static async Task RecomputeLeadValueAndScoreInBackgroundAsync(IServiceProvider services)
    {
        try
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
            await RecomputeLeadValueAndScoreAsync(db);
        }
        catch
        {
            // Best-effort background repair — swallow everything.
        }
    }

    private static async Task RecomputeLeadValueAndScoreAsync(CrmDbContext db)
    {
        try
        {
            var leads = await db.Leads.IgnoreQueryFilters()
                .Where(l => !l.IsDeleted && (l.Score == 0 || l.EstimatedValue < 1000m))
                .ToListAsync();
            if (leads.Count == 0) return;

            // Activity counts per lead in one grouped query.
            var counts = await db.Activities.IgnoreQueryFilters()
                .Where(a => !a.IsDeleted && a.RelatedToType == "lead")
                .GroupBy(a => a.RelatedToId)
                .Select(g => new { LeadId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.LeadId, x => x.Count);

            foreach (var lead in leads)
            {
                // Recover requirement fields that were captured but never promoted (custom field names).
                lead.RecoverRequirements(
                    whatsApp:          PickFromCustomFields(lead.CustomFields, RequirementSynonyms[3].Keys),
                    interestedIn:      PickFromCustomFields(lead.CustomFields, RequirementSynonyms[2].Keys),
                    budget:            PickFromCustomFields(lead.CustomFields, RequirementSynonyms[0].Keys),
                    message:           PickFromCustomFields(lead.CustomFields, RequirementSynonyms[4].Keys),
                    purchaseTimeframe: PickFromCustomFields(lead.CustomFields, RequirementSynonyms[1].Keys));

                // Re-derive value, forcing over a bad tiny legacy value (< 1000).
                lead.DeriveEstimatedValueFromBudget(overrideExisting: lead.EstimatedValue < 1000m);
                lead.RecalculateScore(counts.TryGetValue(lead.Id, out var c) ? c : 0);
            }

            await db.SaveChangesAsync();
        }
        catch
        {
            // Best-effort backfill — never block startup on it.
        }
    }
}
