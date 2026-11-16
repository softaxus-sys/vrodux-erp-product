using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Seo.Application.Profile;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Profile;

public sealed record AutofillResult(
    bool Filled, string Name, string Industry, string Summary, IReadOnlyList<string> Offers, string Audience, string ServiceAreas, string Source, string Note);

/// <summary>
/// Decides what goes into an automatically filled profile, from the three things we can learn without asking anyone: the workspace's own
/// company details, the AI's reading of the website, and the website's own title. Pure, so the rules are exact and tested.
/// </summary>
public static class ProfileAutofillComposer
{
    /// <param name="workspaceMatchesSite">False when the workspace's recorded website is a different site: its company details then describe another business.</param>
    public static AutofillResult Compose(string siteName, TenantProposal workspace, bool? workspaceMatchesSite, BusinessProfileDraftDto? read, string? homeTitle)
    {
        var useWorkspace = workspace.Enough && workspaceMatchesSite != false;

        var name = useWorkspace ? workspace.Name : TitleName(homeTitle) ?? siteName;
        var industry = read?.Industry is { Length: > 0 } i ? i : useWorkspace ? workspace.Industry : "";

        var readSummary = read?.Summary is { Length: >= SeoBusinessProfile.MinSummaryLength } rs ? rs : null;
        var summary = readSummary ?? (useWorkspace ? workspace.Summary : "");

        var areas = read?.ServiceAreas is { Length: > 0 } a ? a : useWorkspace ? workspace.ServiceAreas : "";
        var parts = new List<string>();
        if (readSummary is not null) parts.Add($"{read!.PagesRead} page(s) of your website");
        if (useWorkspace) parts.Add("your workspace's company details");

        return new AutofillResult(
            summary.Length >= SeoBusinessProfile.MinSummaryLength, name, industry, summary, read?.Offers ?? [], read?.Audience ?? "", areas,
            readSummary is not null ? ProfileSources.Website : ProfileSources.Tenant,
            parts.Count == 0 ? "" : $"Filled in from {string.Join(" and ", parts)}. Check it, fix anything wrong, then confirm.");
    }

    /// <summary>"Smile Dental | Family dentist in Islamabad" → "Smile Dental".</summary>
    public static string? TitleName(string? title)
    {
        var t = (title ?? "").Trim();
        if (t.Length == 0) return null;
        var cut = t.IndexOfAny(['|', '–', '—', '·', '•']);
        var dash = t.IndexOf(" - ", StringComparison.Ordinal);
        if (dash >= 0 && (cut < 0 || dash < cut)) cut = dash;
        var name = (cut > 0 ? t[..cut] : t).Trim();
        return name.Length is >= 2 and <= 80 ? name : null;
    }
}

public interface IProfileAutofillQueue
{
    void Enqueue(Guid tenantId, Guid siteId);
}

internal sealed class ProfileAutofillQueue : IProfileAutofillQueue
{
    public readonly Channel<(Guid TenantId, Guid SiteId)> Channel =
        System.Threading.Channels.Channel.CreateUnbounded<(Guid, Guid)>(new UnboundedChannelOptions { SingleReader = true });

    public void Enqueue(Guid tenantId, Guid siteId) => Channel.Writer.TryWrite((tenantId, siteId));
}

public interface IProfileAutofill
{
    /// <summary>Fills in a pending profile as a draft. The caller has already put the site's workspace in scope. Never throws for a site that cannot be read.</summary>
    Task RunAsync(Guid siteId, CancellationToken ct);
}

internal sealed class ProfileAutofill(
    SeoDbContext db, SiteTextReader reader, IBusinessProfileDrafter drafter, ITenantBusinessReader workspace, ILogger<ProfileAutofill> logger) : IProfileAutofill
{
    public async Task RunAsync(Guid siteId, CancellationToken ct)
    {
        var site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.Id == siteId, ct);
        var profile = await db.BusinessProfiles.FirstOrDefaultAsync(p => p.SiteId == siteId, ct);
        // Only ever fill a profile that is waiting for it: never overwrite something a person wrote or confirmed.
        if (site is null || profile is null || profile.AutofillStatus != AutofillStatuses.Pending) return;

        try
        {
            var details = TenantAmbient.TenantId is { } tid ? await workspace.GetAsync(tid, ct) : null;
            var proposal = TenantProfileMapper.Propose(details);
            var matches = TenantProfileMapper.WebsiteMatches(details?.Website, site.Domain);

            IReadOnlyList<SiteText> pages = [];
            try { pages = await reader.ReadAsync(site.Domain, ct); }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex) { logger.LogInformation(ex, "Could not read {Domain} for the business profile.", site.Domain); }

            BusinessProfileDraftDto? read = null;
            string? aiProblem = null;
            if (pages.Any(p => p.Body.Length >= 40))
            {
                try { read = await drafter.DraftAsync(pages, ct); }
                catch (InvalidOperationException ex) { aiProblem = ex.Message; }
            }

            var result = ProfileAutofillComposer.Compose(site.DisplayName, proposal, matches, read, pages.FirstOrDefault()?.Title);
            if (result.Filled)
            {
                profile.ApplyAutofill(result.Name, result.Industry, result.Summary, result.Offers, result.Audience, result.ServiceAreas, result.Source, result.Note);
            }
            else
            {
                var why = pages.Count == 0 ? $"We could not read {site.Domain} (it may block automated visitors)."
                    : aiProblem is not null ? $"We read {site.Domain}, but could not draft a profile: {aiProblem}"
                    : "We could not find enough on the website to describe the business.";
                profile.FailAutofill($"{why} Fill it in by hand.");
            }
            await db.SaveChangesAsync(ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Business profile autofill failed for site {Site}.", siteId);
            db.ChangeTracker.Clear();
            var again = await db.BusinessProfiles.FirstOrDefaultAsync(p => p.SiteId == siteId, ct);
            if (again is { AutofillStatus: AutofillStatuses.Pending }) { again.FailAutofill("Something went wrong while filling this in. Try again, or fill it in by hand."); await db.SaveChangesAsync(ct); }
        }
    }
}

/// <summary>Runs queued fills one at a time, each inside its own workspace. Starts late and re-queues anything left pending after a restart.</summary>
internal sealed class ProfileAutofillBackgroundService(ProfileAutofillQueue queue, IServiceScopeFactory scopes, ILogger<ProfileAutofillBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan PerSiteLimit = TimeSpan.FromMinutes(3);

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(20), stop); } catch (OperationCanceledException) { return; }

        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SeoDbContext>();
            var pending = await db.BusinessProfiles.IgnoreQueryFilters()
                .Where(p => p.AutofillStatus == AutofillStatuses.Pending)
                .Select(p => new { p.SiteId, TenantId = EF.Property<Guid?>(p, "TenantId") }).ToListAsync(stop);
            foreach (var p in pending.Where(p => p.TenantId.HasValue)) queue.Enqueue(p.TenantId!.Value, p.SiteId);
        }
        catch (Exception ex) { logger.LogError(ex, "Could not re-queue unfinished business profile fills."); }

        await foreach (var (tenantId, siteId) in queue.Channel.Reader.ReadAllAsync(stop))
        {
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                using var scope = scopes.CreateScope();
                using var limit = CancellationTokenSource.CreateLinkedTokenSource(stop);
                limit.CancelAfter(PerSiteLimit);
                try { await scope.ServiceProvider.GetRequiredService<IProfileAutofill>().RunAsync(siteId, limit.Token); }
                catch (OperationCanceledException) when (!stop.IsCancellationRequested)
                {
                    // Took too long: say so instead of leaving it "reading…" forever.
                    TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                    var db = scope.ServiceProvider.GetRequiredService<SeoDbContext>();
                    db.ChangeTracker.Clear();
                    var p = await db.BusinessProfiles.FirstOrDefaultAsync(x => x.SiteId == siteId, stop);
                    if (p is { AutofillStatus: AutofillStatuses.Pending }) { p.FailAutofill("Reading the website took too long. Try again, or fill it in by hand."); await db.SaveChangesAsync(stop); }
                }
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex) { logger.LogError(ex, "Business profile fill for site {Site} crashed.", siteId); }
            finally { TenantAmbient.Clear(); }
        }
    }
}
