using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Google;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Content;

public sealed record ResearchSignal(string Kind, string Detail); // kind: "gsc_query" | "competitor_topic" | "own_page"

public sealed record ResearchResult(IReadOnlyList<ResearchSignal> Signals, IReadOnlyList<string> OwnPageTitles);

/// <summary>
/// Gathers what real signal is available before an article is written, so the AI is steering off
/// actual data wherever any exists rather than pure invention.
///
/// <para><b>Honesty note (same principle as GoogleOAuthClient's Search Console remark):</b> there is
/// no live "Google Trends" integration here — Google publishes no supported Trends API, and the
/// unofficial scraping-based ones are fragile and against Google's terms. Claiming trend data this
/// codebase doesn't actually have would be worse than not building it. What IS real: (1) GSC Search
/// Analytics — queries this exact site already gets impressions for (a genuine content-gap signal:
/// meaningful impressions at a weak position means real demand this site isn't fully capturing yet);
/// (2) competitor pages the tenant names manually, crawled the same way the site's own scan crawls
/// pages — topics they cover that a signal search doesn't turn up on this site; (3) the site's own
/// existing page titles, so the AI doesn't propose an article that already exists. No signal at all
/// (a fresh site, no GSC connected, no competitors named) still produces an article — from the niche
/// hint and the AI's own SEO knowledge of the site's apparent industry — but the settings screen says
/// plainly that results improve once GSC is connected or competitors are named.
/// </para>
/// </summary>
public sealed class ContentResearch(SiteCrawler crawler, GoogleOAuthClient google, GoogleAccessTokenResolver tokenResolver, ILogger<ContentResearch> logger)
{
    private const int MaxCompetitors = 3;

    public async Task<ResearchResult> GatherAsync(SeoDbContext db, SeoSite site, SeoContentSettings settings, CancellationToken ct)
    {
        var signals = new List<ResearchSignal>();

        // 1. This site's own existing pages — so the AI never proposes something already covered.
        var ownPages = await crawler.CrawlAsync(site.Domain, ct);
        var ownTitles = ownPages.Where(p => !string.IsNullOrWhiteSpace(p.Title)).Select(p => p.Title!).ToList();

        // 2. GSC Search Analytics, if connected — real query data for this exact site.
        try
        {
            var gscResource = await db.GoogleResources
                .Where(r => r.ResourceType == SeoGoogleResourceTypes.GscProperty)
                .Join(db.GoogleIntegrations.Where(i => i.SiteId == site.Id), r => r.IntegrationId, i => i.Id, (r, i) => r)
                .FirstOrDefaultAsync(ct);

            if (gscResource is not null)
            {
                var token = await tokenResolver.ResolveAsync(db, site.Id, ct);
                if (token is not null)
                {
                    var rows = await google.GetSearchAnalyticsAsync(token, gscResource.ExternalId, ct);
                    // Meaningful impressions but not already ranking well (position > 8) = a real gap.
                    foreach (var row in rows.Where(r => r.Impressions >= 5 && r.Position > 8).OrderByDescending(r => r.Impressions).Take(15))
                        signals.Add(new ResearchSignal("gsc_query", $"\"{row.Query}\" — {row.Impressions:0} impressions, avg. position {row.Position:0.0}"));
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GSC research signal failed for site {Site} — continuing without it.", site.Id);
        }

        // 3. Named competitors, crawled the same way the site's own scan crawls pages.
        if (!string.IsNullOrWhiteSpace(settings.CompetitorDomainsCsv))
        {
            var competitors = settings.CompetitorDomainsCsv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Take(MaxCompetitors);
            foreach (var domain in competitors)
            {
                try
                {
                    var pages = await crawler.CrawlAsync(domain, ct);
                    foreach (var p in pages.Where(p => !string.IsNullOrWhiteSpace(p.Title)).Take(10))
                        signals.Add(new ResearchSignal("competitor_topic", $"{domain}: \"{p.Title}\""));
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Competitor crawl failed for {Domain} — continuing without it.", domain);
                }
            }
        }

        return new ResearchResult(signals, ownTitles);
    }
}
