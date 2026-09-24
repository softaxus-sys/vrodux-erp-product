using AngleSharp;

namespace Softaxis.Seo.Infrastructure.Crawl;

public sealed record CrawledPage(
    string Url, string? Title, string? MetaDescription, string? Canonical,
    bool HasJsonLdSchema, IReadOnlyList<string> ImagesMissingAlt, int H1Count);

/// <summary>
/// Fetches and parses a small set of a site's own pages via HttpClient + AngleSharp. Deliberately
/// not a full crawler for Phase 1 — the homepage plus whatever sitemap.xml lists, capped, is enough
/// to produce real technical/on-page findings without building crawl-frontier infrastructure.
/// </summary>
public sealed class SiteCrawler(IHttpClientFactory httpFactory)
{
    private const int MaxPages = 20;

    public async Task<IReadOnlyList<CrawledPage>> CrawlAsync(string domain, CancellationToken ct)
    {
        var client  = httpFactory.CreateClient("seo-crawler");
        var baseUrl = $"https://{domain}";
        var urls    = await DiscoverUrlsAsync(client, baseUrl, ct);

        var pages = new List<CrawledPage>();
        foreach (var url in urls.Take(MaxPages))
        {
            if (ct.IsCancellationRequested) break;
            var page = await FetchPageAsync(client, url, ct);
            if (page is not null) pages.Add(page);
        }
        return pages;
    }

    private static async Task<List<string>> DiscoverUrlsAsync(HttpClient client, string baseUrl, CancellationToken ct)
    {
        var urls = new List<string> { baseUrl };
        try
        {
            var xml = await client.GetStringAsync($"{baseUrl}/sitemap.xml", ct);
            var doc = System.Xml.Linq.XDocument.Parse(xml);
            var ns  = doc.Root?.Name.Namespace ?? System.Xml.Linq.XNamespace.None;
            urls.AddRange(doc.Descendants(ns + "loc")
                .Select(e => e.Value.Trim())
                .Where(u => !string.IsNullOrEmpty(u)));
        }
        catch
        {
            // No sitemap, or it didn't parse — homepage-only crawl still runs. Never fails the scan.
        }
        return urls.Distinct().ToList();
    }

    private static async Task<CrawledPage?> FetchPageAsync(HttpClient client, string url, CancellationToken ct)
    {
        try
        {
            using var resp = await client.GetAsync(url, ct);
            if (!resp.IsSuccessStatusCode) return null;
            var html = await resp.Content.ReadAsStringAsync(ct);

            using var document = await BrowsingContext.New(Configuration.Default).OpenAsync(req => req.Content(html), ct);

            var title          = document.QuerySelector("title")?.TextContent?.Trim();
            var metaDesc       = document.QuerySelector("meta[name='description']")?.GetAttribute("content")?.Trim();
            var canonical      = document.QuerySelector("link[rel='canonical']")?.GetAttribute("href")?.Trim();
            var hasSchema      = document.QuerySelectorAll("script[type='application/ld+json']").Length > 0;
            var h1Count        = document.QuerySelectorAll("h1").Length;
            var missingAlt     = document.QuerySelectorAll("img")
                .Where(img => string.IsNullOrWhiteSpace(img.GetAttribute("alt")))
                .Select(img => img.GetAttribute("src") ?? "(no src)")
                .Take(10)
                .ToList();

            return new CrawledPage(url, title, metaDesc, canonical, hasSchema, missingAlt, h1Count);
        }
        catch
        {
            return null; // one unreachable page must not fail the whole scan
        }
    }
}
