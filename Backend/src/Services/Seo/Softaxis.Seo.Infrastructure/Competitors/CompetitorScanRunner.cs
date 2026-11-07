using System.Text.Json;
using System.Threading.Channels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Seo.Application.Competitors;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Credits;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Competitors;

/// <summary>Search markets the keyword data can be bought for (DataForSEO location codes).</summary>
public static class CompetitorLocations
{
    public const int Default = 2784;

    public static readonly IReadOnlyList<LocationOptionDto> All =
    [
        new(2784, "United Arab Emirates"), new(2682, "Saudi Arabia"), new(2634, "Qatar"), new(2414, "Kuwait"), new(2048, "Bahrain"),
        new(2512, "Oman"), new(2818, "Egypt"), new(2586, "Pakistan"), new(2356, "India"), new(2826, "United Kingdom"),
        new(2840, "United States"), new(2124, "Canada"), new(2036, "Australia"),
    ];

    public static bool IsKnown(int code) => All.Any(l => l.Code == code);
}

public interface ICompetitorScanRunner
{
    /// <summary>Runs one queued comparison. The caller has already put the scan's workspace in scope.</summary>
    Task RunAsync(Guid scanId, CancellationToken ct);
}

/// <summary>
/// One comparison: read the pages of the site and each competitor, buy (or reuse) the keyword lists, work out the gaps, build the 30-day
/// plan, and charge. Credits are taken after the work for what was really used, so a comparison that fails costs nothing; the caller
/// checks the balance covers the maximum before it is queued.
/// </summary>
public sealed class CompetitorScanRunner(
    SeoDbContext db, SiteCrawler crawler, IKeywordDataProvider keywords, ISeoCreditService credits, SeoOptions options, ILogger<CompetitorScanRunner> logger)
    : ICompetitorScanRunner
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task RunAsync(Guid scanId, CancellationToken ct)
    {
        var scan = await db.CompetitorScans.FirstOrDefaultAsync(s => s.Id == scanId, ct);
        if (scan is null || scan.Status is CompetitorScanStatuses.Completed or CompetitorScanStatuses.Failed) return;
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == scan.SiteId, ct);
        if (site is null) { scan.Fail("The website was removed."); await db.SaveChangesAsync(ct); return; }

        scan.Start();
        await db.SaveChangesAsync(ct);

        try
        {
            var domains = JsonSerializer.Deserialize<List<string>>(scan.CompetitorsJson, Json) ?? [];
            var limits = new CrawlLimits(options.CompetitorPagesPerDomain, options.CrawlConcurrency, 0);

            // ── Pages ────────────────────────────────────────────────────────
            var ownCrawl = await crawler.CrawlSiteAsync(site.Domain, limits, ct);
            var totalPages = ownCrawl.Pages.Count(p => !p.BlockedByRobots);
            var own = ToText(ownCrawl);

            var compPages = new Dictionary<string, IReadOnlyList<PageText>>(StringComparer.Ordinal);
            var unreadable = new List<string>();
            foreach (var d in domains)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    var c = await crawler.CrawlSiteAsync(d, limits, ct);
                    totalPages += c.Pages.Count(p => !p.BlockedByRobots);
                    var text = ToText(c);
                    if (text.Count == 0) unreadable.Add(d); else compPages[d] = text;
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex) { logger.LogInformation(ex, "Competitor {Domain} could not be read.", d); unreadable.Add(d); }
            }
            if (compPages.Count == 0)
            {
                scan.Fail("None of the competitor websites could be read. They may block automated visitors, or the addresses may be wrong.");
                await db.SaveChangesAsync(ct);
                return;
            }

            // ── Keywords ─────────────────────────────────────────────────────
            var kwUsed = false; string? note = null; var freshCompetitors = 0;
            IReadOnlyList<KeywordGapDto> kwGaps = [];
            if (!keywords.IsConfigured)
                note = "Search-volume data is not switched on for this platform yet, so only the page-topic comparison was run.";
            else
            {
                try
                {
                    var (ownRows, _) = await KeywordsFor(site.Id, site.Domain, isOwn: true, scan.LocationCode, ct);
                    var compRows = new Dictionary<string, IReadOnlyList<KeywordRow>>(StringComparer.Ordinal);
                    foreach (var d in compPages.Keys)
                    {
                        try
                        {
                            var (rows, fresh) = await KeywordsFor(site.Id, d, isOwn: false, scan.LocationCode, ct);
                            compRows[d] = rows;
                            if (fresh) freshCompetitors++;
                        }
                        catch (KeywordProviderException ex) { note = ex.Message; }
                    }
                    if (compRows.Count > 0)
                    {
                        kwGaps = CompetitorAnalysis.KeywordGaps(ownRows, compRows);
                        kwUsed = true;
                        if (compRows.Count < compPages.Count) note ??= "Search-volume data could not be fetched for every competitor.";
                    }
                }
                catch (KeywordProviderException ex) { note = ex.Message + " The page-topic comparison was still run."; }
            }
            if (unreadable.Count > 0)
                note = (note is null ? "" : note + " ") + $"Could not read: {string.Join(", ", unreadable)}.";

            // ── Analysis + plan ──────────────────────────────────────────────
            var topicGaps = CompetitorAnalysis.TopicGaps(own, compPages);
            var slots = CompetitorAnalysis.BuildPlan(kwGaps, topicGaps, DateOnly.FromDateTime(DateTime.UtcNow));

            // ── Charge what was really used ──────────────────────────────────
            var cost = options.CreditsFor(Math.Max(1, totalPages)) + freshCompetitors * options.CreditsPerCompetitorKeywords;
            var spend = await credits.TrySpendAsync(cost, "Competitor analysis", "competitor-scan", scan.Id, $"competitor-scan:{scan.Id}", ct);
            if (!spend.Ok)
            {
                scan.Fail("There were not enough credits left to finish this comparison. Nothing was charged.");
                await db.SaveChangesAsync(ct);
                return;
            }

            foreach (var s in slots)
                db.PlanItems.Add(new SeoPlanItem(site.Id, scan.Id, s.PlannedDate, s.Title, s.TargetKeyword, s.Reason, s.Volume, s.Difficulty, s.Source));
            scan.Complete(totalPages, cost, kwUsed, note, JsonSerializer.Serialize(topicGaps, Json), JsonSerializer.Serialize(kwGaps, Json));
            await db.SaveChangesAsync(ct);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Competitor scan {Scan} failed.", scanId);
            db.ChangeTracker.Clear();
            var again = await db.CompetitorScans.FirstOrDefaultAsync(s => s.Id == scanId, ct);
            if (again is not null) { again.Fail("The comparison could not be completed. Nothing was charged. Please try again."); await db.SaveChangesAsync(ct); }
        }
    }

    private static List<PageText> ToText(CrawlResult crawl) =>
        crawl.Pages.Where(p => p.IsHtml && p.Ok && !p.BlockedByRobots)
            .Select(p => new PageText(p.FinalUrl, p.Title, p.H1s.FirstOrDefault()))
            .Where(p => !string.IsNullOrWhiteSpace(p.Title) || !string.IsNullOrWhiteSpace(p.H1))
            .DistinctBy(p => p.Url).ToList();

    /// <summary>A bought list younger than the cache window is reused for free; otherwise it is bought and kept.</summary>
    private async Task<(IReadOnlyList<KeywordRow> Rows, bool Fresh)> KeywordsFor(Guid siteId, string domain, bool isOwn, int location, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-options.KeywordCacheDays);
        var snap = await db.KeywordSnapshots.AsNoTracking()
            .Where(s => s.SiteId == siteId && s.Domain == domain && s.LocationCode == location && s.FetchedAt > since)
            .OrderByDescending(s => s.FetchedAt).FirstOrDefaultAsync(ct);
        if (snap is not null)
            return (JsonSerializer.Deserialize<List<KeywordRow>>(snap.ItemsJson, Json) ?? [], false);

        var rows = await keywords.RankedKeywordsAsync(domain, location, ct);
        db.KeywordSnapshots.Add(new SeoKeywordSnapshot(siteId, domain, isOwn, location, JsonSerializer.Serialize(rows, Json), rows.Count));
        await db.SaveChangesAsync(ct);
        return (rows, true);
    }
}

// ── Queue + worker ────────────────────────────────────────────────────────────

public interface ICompetitorScanQueue
{
    void Enqueue(Guid tenantId, Guid scanId);
}

internal sealed class CompetitorScanQueue : ICompetitorScanQueue
{
    public readonly Channel<(Guid TenantId, Guid ScanId)> Channel =
        System.Threading.Channels.Channel.CreateUnbounded<(Guid, Guid)>(new UnboundedChannelOptions { SingleReader = true });

    public void Enqueue(Guid tenantId, Guid scanId) => Channel.Writer.TryWrite((tenantId, scanId));
}

/// <summary>
/// Runs queued comparisons one at a time, each inside its own workspace. After a restart, anything still queued or running is queued
/// again (single-instance assumption, same as the other background jobs). Starts late so it never delays the deploy health check.
/// </summary>
internal sealed class CompetitorScanBackgroundService(CompetitorScanQueue queue, IServiceScopeFactory scopes, ILogger<CompetitorScanBackgroundService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        try { await Task.Delay(TimeSpan.FromSeconds(90), stop); } catch (OperationCanceledException) { return; }

        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SeoDbContext>();
            var pending = await db.CompetitorScans.IgnoreQueryFilters()
                .Where(s => s.Status == CompetitorScanStatuses.Queued || s.Status == CompetitorScanStatuses.Running)
                .Select(s => new { s.Id, TenantId = EF.Property<Guid?>(s, "TenantId") }).ToListAsync(stop);
            foreach (var p in pending.Where(p => p.TenantId.HasValue)) queue.Enqueue(p.TenantId!.Value, p.Id);
        }
        catch (Exception ex) { logger.LogError(ex, "Could not re-queue unfinished competitor scans."); }

        await foreach (var (tenantId, scanId) in queue.Channel.Reader.ReadAllAsync(stop))
        {
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ICompetitorScanRunner>().RunAsync(scanId, stop);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex) { logger.LogError(ex, "Competitor scan {Scan} crashed.", scanId); }
            finally { TenantAmbient.Clear(); }
        }
    }
}
