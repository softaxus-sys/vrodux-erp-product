using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.CRM.Application;
using Softaxis.CRM.Application.LeadIntake;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Infrastructure.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;
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
        services.AddScoped<Services.IDealStageRecorder, Services.DealStageRecorder>();
        services.AddScoped<Services.ILeadStatusRecorder, Services.LeadStatusRecorder>();

        // The batched Property Finder import keeps its plan here between slices.
        services.AddMemoryCache();

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

        // ── Property Finder — Enterprise API (webhook + poll + historical backfill) ──
        // Enquiries (WhatsApp / phone call / email) become leads. A lead references its listing by
        // id only, so the provider looks the listing up to attach the property title and price.
        services.Configure<PropertyFinderOptions>(configuration.GetSection(PropertyFinderOptions.Section));
        // A User-Agent is REQUIRED, not cosmetic: atlas.propertyfinder.com sits behind CloudFront,
        // which rejects requests with an empty User-Agent with a 403 "Request blocked" HTML page —
        // before the API is reached, so it looks exactly like a revoked API key. HttpClient sends
        // no User-Agent by default, so it must be set explicitly.
        services.AddHttpClient("property-finder", c =>
        {
            c.DefaultRequestHeaders.UserAgent.ParseAdd("VroduxERP/1.0 (+https://vrodux.com)");
            c.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            c.Timeout = TimeSpan.FromSeconds(60);
        });
        services.AddSingleton<PropertyFinderApiClient>();
        // Per-tenant credentials: scoped, because it reads the caller's own integration row.
        services.AddScoped<PropertyFinderCredentialStore>();
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

        // Gap-fill behind the webhooks: a delivery made while the gateway was restarting is lost
        // for good, and nothing would otherwise notice. Dedupe makes overlapping with the webhook
        // harmless — an already-ingested lead simply comes back as a duplicate.
        services.AddHostedService<LeadPollSyncService>();

        return services;
    }

    private static void AddStub(IServiceCollection services, string key, string name, string category,
        string description, ProviderCapabilities planned) =>
        services.AddSingleton<ILeadProvider>(_ => new StubLeadProvider(key, name, category, description, planned));

    public static async Task MigrateAndSeedCrmAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();

        // Backfill value + score for existing leads — can be heavy on a large lead table, so run it in
        // the background (own scope) rather than blocking startup readiness / the deploy health check.
        _ = Task.Run(() => RecomputeLeadValueAndScoreInBackgroundAsync(services));

        // Give already-closed opportunities and already-converted leads a date, so the reports have
        // history to show on day one instead of an empty chart. Also potentially large — background.
        _ = Task.Run(() => BackfillReportingDatesInBackgroundAsync(services));

        // File untagged records under their owner's team, but only where that is unambiguous.
        _ = Task.Run(() => BackfillRecordTeamsInBackgroundAsync(services));

        // Opportunities and accounts created by lead conversion before ConvertLeadHandler carried the
        // owner across are unowned, which makes them invisible to every tier except full access — a
        // rep converts a lead and loses the result. Idempotent: only ever fills a NULL owner.
        await BackfillConvertedRecordOwnersAsync(db);

        // Demo CRM data (leads/customers/deals with no tenant) is dev scaffolding only. The old
        // ASPNETCORE_ENVIRONMENT != "Production" gate was ineffective — prod runs as "Docker" — so
        // it seeded into real deployments. Now gated by the explicit Seeding:DemoData flag (off by
        // default; on only in local dev). Real/trial/new tenants get no demo data.
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => CrmSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await CrmSeedData.SeedAsync(db);
    }

    /// <summary>
    /// Gives converted opportunities and accounts the owner of the lead they came from, wherever that
    /// owner is still NULL. Keyed off Lead.ConvertedDealId / ConvertedCustomerId, so it only ever
    /// touches records that conversion actually produced. Runs every startup; a no-op once clean, and
    /// never overwrites an owner someone has since set. Best-effort — a failure here must not stop
    /// the service booting.
    /// </summary>
    private static async Task BackfillConvertedRecordOwnersAsync(CrmDbContext db)
    {
        try
        {
            // IgnoreQueryFilters: there is no ambient tenant during startup, so the global filter
            // would match nothing at all.
            var converted = await db.Leads.IgnoreQueryFilters()
                .Where(l => l.AssignedToUserId != null
                         && (l.ConvertedDealId != null || l.ConvertedCustomerId != null))
                .Select(l => new { l.AssignedToUserId, l.AssignedTo, l.ConvertedDealId, l.ConvertedCustomerId })
                .ToListAsync();

            if (converted.Count == 0) return;

            var dealOwner = new Dictionary<Guid, (Guid User, string Name)>();
            var custOwner = new Dictionary<Guid, (Guid User, string Name)>();

            foreach (var c in converted)
            {
                if (Guid.TryParse(c.ConvertedDealId, out var dealId))
                    dealOwner[dealId] = (c.AssignedToUserId!.Value, c.AssignedTo);
                if (c.ConvertedCustomerId is { } custId)
                    custOwner[custId] = (c.AssignedToUserId!.Value, c.AssignedTo);
            }

            var changed = 0;

            var dealIds = dealOwner.Keys.ToList();
            foreach (var deal in await db.Deals.IgnoreQueryFilters()
                         .Where(d => d.AssignedToUserId == null && dealIds.Contains(d.Id)).ToListAsync())
            {
                var (user, name) = dealOwner[deal.Id];
                deal.AssignTo(user, string.IsNullOrWhiteSpace(deal.AssignedTo) ? name : deal.AssignedTo);
                changed++;
            }

            var custIds = custOwner.Keys.ToList();
            foreach (var cust in await db.Customers.IgnoreQueryFilters()
                         .Where(c => c.AccountManagerUserId == null && custIds.Contains(c.Id)).ToListAsync())
            {
                var (user, name) = custOwner[cust.Id];
                cust.AssignAccountManager(user, string.IsNullOrWhiteSpace(cust.AccountManager) ? name : cust.AccountManager);
                changed++;
            }

            if (changed > 0) await db.SaveChangesAsync();
        }
        catch
        {
            // Never crash-loop startup over a data repair.
        }
    }

    /// <summary>Recover budget/timeframe/interest/whatsapp/message that were captured under a custom
    /// question name and landed in the lead's CustomFields (Form Responses) — using the same normalized
    /// classifier the providers use, so "your_budget?" / "when_are_you_planning_to_invest?" are matched.</summary>
    private static void RecoverFromCustomFields(Softaxis.CRM.Domain.Entities.Lead lead)
    {
        if (lead.CustomFields is not { Count: > 0 } cf) return;
        string? budget = null, timeframe = null, interest = null, whatsapp = null, message = null;
        foreach (var (k, v) in cf)
        {
            if (string.IsNullOrWhiteSpace(v)) continue;
            switch (LeadFieldClassifier.Classify(k))
            {
                case CanonicalLeadFields.Budget:       budget    ??= v; break;
                case CanonicalLeadFields.Timeframe:    timeframe ??= v; break;
                case CanonicalLeadFields.InterestedIn: interest  ??= v; break;
                case CanonicalLeadFields.WhatsApp:     whatsapp  ??= v; break;
                case CanonicalLeadFields.Message:      message   ??= v; break;
            }
        }
        lead.RecoverRequirements(whatsapp, interest, budget, message, timeframe);
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

    /// <summary>
    /// Fills <c>Deal.ClosedAt</c> and <c>Lead.ConvertedAt</c> on rows that predate reporting, so the
    /// win/loss, conversion and velocity reports have usable history the day this ships instead of
    /// starting from empty.
    /// <para>
    /// <b>The dates are approximate and that is deliberate.</b> The true close/convert moment was never
    /// recorded, so the best available proxy is <c>UpdatedAt</c> (the last write to the row, which for a
    /// closed deal is usually the close itself), falling back to <c>CreatedAt</c>. Backfilled rows are
    /// therefore directionally right but not exact; reporting is accurate from deploy onward. The
    /// alternative — leaving them null — would silently drop all historic deals out of every report,
    /// which reads as "we never sold anything" and is worse than an approximate date.
    /// </para>
    /// Idempotent: only ever fills a NULL, so re-running on every startup is a no-op once complete.
    /// </summary>
    private static async Task BackfillReportingDatesInBackgroundAsync(IServiceProvider services)
    {
        try
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();

            // No ambient tenant during startup, so span every tenant explicitly.
            var deals = await db.Deals.IgnoreQueryFilters()
                .Where(d => d.ClosedAt == null && (d.Stage == "won" || d.Stage == "lost"))
                .ToListAsync();
            foreach (var d in deals) d.BackfillClosedAt(d.UpdatedAt ?? d.CreatedAt);

            var leads = await db.Leads.IgnoreQueryFilters()
                .Where(l => l.ConvertedAt == null && l.Status == "converted")
                .ToListAsync();
            foreach (var l in leads) l.BackfillConvertedAt(l.UpdatedAt ?? l.CreatedAt);

            if (deals.Count > 0 || leads.Count > 0) await db.SaveChangesAsync();
        }
        catch
        {
            // Best-effort background repair — never let it surface or crash-loop startup.
        }
    }

    /// <summary>
    /// Files existing leads / opportunities / accounts under a team, so a team lead's view narrows
    /// from "everything my members own" to "my team's work".
    /// <para>
    /// <b>Only where it is unambiguous.</b> A record is tagged only when its owner belongs to exactly
    /// ONE active team. Owners in several teams — the very case that made ownership an unreliable
    /// signal — are left untagged, because picking one would be a guess, and a wrong guess silently
    /// removes a record from a team lead who legitimately had it. Untagged records keep the previous
    /// owner-membership behaviour until someone assigns them a team explicitly.
    /// </para>
    /// Idempotent: only ever fills a NULL, so re-running each startup is a no-op once complete.
    /// </summary>
    private static async Task BackfillRecordTeamsInBackgroundAsync(IServiceProvider services)
    {
        try
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();

            // ── Step 1: inherit the team from the record's ORIGIN ────────────────────────────
            //
            // A deal or account created by converting a lead belongs to whatever team that lead was
            // filed to. This is a real link (Lead.ConvertedDealId / ConvertedCustomerId), not a
            // guess, so it takes precedence over the owner heuristic below — and it is the only rule
            // that can file records whose owner sits in several teams, which is exactly the case the
            // owner heuristic has to skip. Conversions from before that link was carried across
            // (Module 30) are repaired here.
            var convertedLeads = await db.Leads.IgnoreQueryFilters()
                .Where(l => l.TeamId != null && (l.ConvertedDealId != null || l.ConvertedCustomerId != null))
                .Select(l => new { l.TeamId, l.ConvertedDealId, l.ConvertedCustomerId })
                .ToListAsync();

            if (convertedLeads.Count > 0)
            {
                var dealTeamByOrigin = new Dictionary<Guid, Guid>();
                var customerTeamByOrigin = new Dictionary<Guid, Guid>();

                foreach (var l in convertedLeads)
                {
                    if (l.TeamId is not { } tid) continue;
                    if (Guid.TryParse(l.ConvertedDealId, out var dealId) && dealId != Guid.Empty)
                        dealTeamByOrigin[dealId] = tid;
                    if (l.ConvertedCustomerId is { } custId)
                        customerTeamByOrigin[custId] = tid;
                }

                if (dealTeamByOrigin.Count > 0)
                {
                    var ids = dealTeamByOrigin.Keys.ToList();
                    var fromConversion = await db.Deals.IgnoreQueryFilters()
                        .Where(d => d.TeamId == null && ids.Contains(d.Id)).ToListAsync();
                    foreach (var d in fromConversion) d.BackfillTeam(dealTeamByOrigin[d.Id]);
                }

                if (customerTeamByOrigin.Count > 0)
                {
                    var ids = customerTeamByOrigin.Keys.ToList();
                    var fromConversion = await db.Customers.IgnoreQueryFilters()
                        .Where(c => c.TeamId == null && ids.Contains(c.Id)).ToListAsync();
                    foreach (var c in fromConversion) c.BackfillTeam(customerTeamByOrigin[c.Id]);
                }

                await db.SaveChangesAsync();
            }

            // ── Step 2: fall back to the owner's team, when unambiguous ──────────────────────
            // Users whose team membership is unambiguous → their single team id.
            // Raw cross-schema read: Identity owns these tables and lives in the same database.
            var soleTeamRows = await db.Database
                .SqlQueryRaw<SoleTeamRow>(@"
                    SELECT m.UserId, MIN(CAST(t.Id AS NVARCHAR(50))) AS TeamId
                    FROM [identity].[team_members] m
                    JOIN [identity].[teams] t ON t.Id = m.TeamId AND t.IsActive = 1 AND t.IsDeleted = 0
                    GROUP BY m.UserId
                    HAVING COUNT(DISTINCT t.Id) = 1")
                .ToListAsync();

            if (soleTeamRows.Count == 0) return;

            var soleTeam = soleTeamRows
                .Where(r => Guid.TryParse(r.TeamId, out _))
                .ToDictionary(r => r.UserId, r => Guid.Parse(r.TeamId));

            // No ambient tenant at startup, so span every tenant explicitly. The owner→team map is
            // itself tenant-consistent (a user belongs to one tenant), so this cannot cross tenants.
            var leads = await db.Leads.IgnoreQueryFilters()
                .Where(l => l.TeamId == null && l.AssignedToUserId != null).ToListAsync();
            foreach (var l in leads)
                if (soleTeam.TryGetValue(l.AssignedToUserId!.Value, out var tid)) l.BackfillTeam(tid);

            var deals = await db.Deals.IgnoreQueryFilters()
                .Where(d => d.TeamId == null && d.AssignedToUserId != null).ToListAsync();
            foreach (var d in deals)
                if (soleTeam.TryGetValue(d.AssignedToUserId!.Value, out var tid)) d.BackfillTeam(tid);

            var customers = await db.Customers.IgnoreQueryFilters()
                .Where(c => c.TeamId == null && c.AccountManagerUserId != null).ToListAsync();
            foreach (var c in customers)
                if (soleTeam.TryGetValue(c.AccountManagerUserId!.Value, out var tid)) c.BackfillTeam(tid);

            await db.SaveChangesAsync();
        }
        catch
        {
            // Best-effort background repair — never let it surface or crash-loop startup.
        }
    }

    /// <summary>Row shape for the sole-team lookup. TeamId is read as a string because
    /// <c>MIN()</c> cannot be applied to uniqueidentifier in SQL Server.</summary>
    private sealed class SoleTeamRow
    {
        public Guid   UserId { get; set; }
        public string TeamId { get; set; } = string.Empty;
    }

    private static async Task RecomputeLeadValueAndScoreAsync(CrmDbContext db)
    {
        try
        {
            // Rescore/repair ALL leads — the scoring weights + value derivation evolve over releases, and
            // RecalculateScore/DeriveEstimatedValueFromBudget are idempotent (they only write when the value
            // actually changes), so re-runs on already-correct leads are no-ops. Runs in the background.
            var leads = await db.Leads.IgnoreQueryFilters()
                .Where(l => !l.IsDeleted)
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
                RecoverFromCustomFields(lead);

                // Authoritatively repair the value from the (trusted) budget — clears misleading legacy
                // values like a static 50,000 guessed from a bare "50"; leaves budget-less leads alone.
                lead.RepairEstimatedValueFromBudget();
                // Tag urgency from the message when no explicit timeframe was captured.
                lead.DetectTimeframeFromText();
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
