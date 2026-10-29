using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using AngleSharp;
using AngleSharp.Dom;
using Microsoft.Extensions.Logging;
using Softaxis.Seo.Infrastructure.Net;

namespace Softaxis.Seo.Infrastructure.Crawl;

public sealed record CrawlLimits(int MaxPages, int Concurrency, int ExternalLinkChecks);

/// <summary>
/// Crawls a customer's own site the way a search engine does: robots.txt first, then the sitemap and the links between pages, a few
/// pages at a time with a polite pause, every page analysed for what matters to ranking. Every request goes through
/// <see cref="SafeFetcher"/>, so a private or internal address, a runaway page or a redirect loop can never hang or abuse the server.
/// </summary>
public sealed class SiteCrawler(SafeFetcher fetcher, ILogger<SiteCrawler> logger)
{
    private static readonly HashSet<string> AssetExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".bmp", ".avif", ".pdf", ".zip", ".gz", ".rar", ".7z", ".mp3", ".mp4", ".mov", ".avi", ".webm",
        ".css", ".js", ".json", ".xml", ".txt", ".woff", ".woff2", ".ttf", ".eot", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".exe", ".dmg", ".apk",
    };
    // Social networks answer a bot with 403 / 999 / 429 whatever the link; treating that as "broken" would be a false alarm every time.
    private static readonly string[] BotHostileHosts = ["facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "pinterest.com", "wa.me", "whatsapp.com", "t.me"];
    private static readonly string[] TrackingParams = ["utm_", "fbclid", "gclid", "msclkid", "mc_cid", "mc_eid", "_ga", "yclid"];

    /// <summary>A light crawl (a handful of pages) for research: titles of a competitor's or the site's own pages.</summary>
    public async Task<IReadOnlyList<CrawledPage>> CrawlAsync(string domain, CancellationToken ct) =>
        (await CrawlSiteAsync(domain, new CrawlLimits(20, 2, 0), ct)).Pages.Where(p => p.IsHtml).ToList();

    public async Task<CrawlResult> CrawlSiteAsync(string domain, CrawlLimits limits, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var scheme = fetcher.AllowPrivate ? "http" : "https";   // a development machine has no certificate for its test site
        var baseUrl = $"{scheme}://{domain}";

        var home = await fetcher.FetchAsync(baseUrl + "/", ct);
        var host = Uri.TryCreate(home.FinalUrl, UriKind.Absolute, out var hu) ? hu.Authority.ToLowerInvariant() : domain;
        var siteHosts = SiteHosts(domain, host);
        var origin = Uri.TryCreate(home.FinalUrl, UriKind.Absolute, out var ou) ? $"{ou.Scheme}://{ou.Authority}" : baseUrl;

        var robots = await ReadRobotsAsync(origin, ct);
        var robotsRules = robots.Found ? RobotsRules.Parse(await RobotsBodyAsync(origin, ct)) : RobotsRules.AllowAll;
        var sitemap = await ReadSitemapsAsync(origin, robots, siteHosts, ct);

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var queue = new Queue<(string Url, int Depth)>();
        var queryVariants = new Dictionary<string, int>(StringComparer.Ordinal);
        void Enqueue(string url, int depth)
        {
            if (!seen.Add(url)) return;
            // /calendar?month=… and ?page=… can be endless; a few variants of one path tell us everything.
            if (Uri.TryCreate(url, UriKind.Absolute, out var u) && u.Query.Length > 1)
            {
                var key = u.GetLeftPart(UriPartial.Path);
                queryVariants[key] = queryVariants.GetValueOrDefault(key) + 1;
                if (queryVariants[key] > 5) return;
            }
            queue.Enqueue((url, depth));
        }

        Enqueue(Normalize(origin + "/", siteHosts) ?? origin + "/", 0);
        foreach (var u in sitemap.Urls) if (Normalize(u, siteHosts) is { } n) Enqueue(n, 1);

        var pages = new List<CrawledPage>();
        var fetched = 0;
        var blocked = 0;
        using var gate = new SemaphoreSlim(Math.Max(1, limits.Concurrency));

        while (queue.Count > 0 && fetched < limits.MaxPages && !ct.IsCancellationRequested)
        {
            var batch = new List<(string Url, int Depth)>();
            while (queue.Count > 0 && batch.Count < limits.Concurrency * 2 && fetched + batch.Count < limits.MaxPages)
            {
                var item = queue.Dequeue();
                var path = Uri.TryCreate(item.Url, UriKind.Absolute, out var iu) ? iu.PathAndQuery : "/";
                if (!robotsRules.IsAllowed(path))
                {
                    // Recorded (we learn it exists), not fetched, and not counted against the page limit or charged.
                    if (blocked++ < 50) pages.Add(BlockedPage(item.Url, item.Depth));
                    continue;
                }
                batch.Add(item);
            }
            if (batch.Count == 0) continue;

            var results = await Task.WhenAll(batch.Select(async b =>
            {
                await gate.WaitAsync(ct);
                try { await Task.Delay(100, ct); return await FetchPageAsync(b.Url, b.Depth, siteHosts, ct); }
                finally { gate.Release(); }
            }));
            fetched += results.Length;

            foreach (var page in results)
            {
                pages.Add(page);
                // A redirect's destination is itself a page; do not fetch it twice.
                if (!page.FinalUrl.Equals(page.Url, StringComparison.Ordinal) && Normalize(page.FinalUrl, siteHosts) is { } fin) seen.Add(fin);
                if (page.IsHtml && page.Ok && !page.Noindex || page.IsHtml && page.Ok)
                    foreach (var link in page.InternalLinks) Enqueue(link, page.Depth + 1);
            }
        }

        var truncated = queue.Count > 0;
        var external = limits.ExternalLinkChecks > 0 ? await CheckExternalLinksAsync(pages, limits.ExternalLinkChecks, ct) : [];

        // Is plain http turned into https? Only meaningful for a real public site.
        var httpsEnforced = true; var httpChecked = false;
        if (!fetcher.AllowPrivate)
        {
            var plain = await fetcher.FetchAsync($"http://{domain}/", ct, head: true, timeout: TimeSpan.FromSeconds(10));
            if (plain.Error is null) { httpChecked = true; httpsEnforced = plain.FinalUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase); }
        }

        logger.LogInformation("SEO crawl of {Domain}: {Pages} pages, {Discovered} discovered, truncated={Truncated}, {Ms} ms.", domain, pages.Count, seen.Count, truncated, sw.ElapsedMilliseconds);
        return new CrawlResult(domain, origin, host, pages, robots, sitemap, external, httpsEnforced, httpChecked, truncated, seen.Count, sw.ElapsedMilliseconds);
    }

    // ── robots.txt and sitemaps ──────────────────────────────────────────────

    private async Task<RobotsInfo> ReadRobotsAsync(string origin, CancellationToken ct)
    {
        var r = await fetcher.FetchAsync(origin + "/robots.txt", ct, maxBytes: 300_000, timeout: TimeSpan.FromSeconds(10));
        if (r.Error is not null) return new RobotsInfo(false, 0, false, [], r.Error);
        if (r.StatusCode != 200 || r.IsHtml) return new RobotsInfo(false, r.StatusCode, false, [], null);   // many sites answer 200 with a page: not a robots file
        var rules = RobotsRules.Parse(r.Body ?? "");
        return new RobotsInfo(true, 200, rules.BlocksEverything, rules.Sitemaps, null);
    }

    private async Task<string> RobotsBodyAsync(string origin, CancellationToken ct) =>
        (await fetcher.FetchAsync(origin + "/robots.txt", ct, maxBytes: 300_000, timeout: TimeSpan.FromSeconds(10))).Body ?? "";

    private async Task<SitemapInfo> ReadSitemapsAsync(string origin, RobotsInfo robots, HashSet<string> siteHosts, CancellationToken ct)
    {
        var roots = robots.Sitemaps.Count > 0 ? robots.Sitemaps.Take(5).ToList() : [origin + "/sitemap.xml"];
        var urls = new List<string>(); var errors = new List<string>();
        var pending = new Queue<(string Url, int Depth)>(roots.Select(r => (r, 0)));
        var fetched = 0; var found = false;

        while (pending.Count > 0 && fetched < 12 && urls.Count < 5000)
        {
            var (url, depth) = pending.Dequeue();
            var r = await fetcher.FetchAsync(url, ct, maxBytes: 5_000_000, timeout: TimeSpan.FromSeconds(15));
            fetched++;
            if (r.Error is not null || r.StatusCode != 200 || string.IsNullOrWhiteSpace(r.Body)) { if (fetched == 1 || robots.Sitemaps.Count > 0) errors.Add($"{url}: {r.Error ?? "HTTP " + r.StatusCode}"); continue; }
            try
            {
                var doc = XDocument.Parse(r.Body);
                var ns = doc.Root?.Name.Namespace ?? XNamespace.None;
                if (doc.Root?.Name.LocalName == "sitemapindex")
                {
                    found = true;
                    foreach (var loc in doc.Descendants(ns + "loc").Select(e => e.Value.Trim()).Where(v => v.Length > 0).Take(10))
                        if (depth < 2) pending.Enqueue((loc, depth + 1));
                }
                else if (doc.Root?.Name.LocalName == "urlset")
                {
                    found = true;
                    foreach (var loc in doc.Descendants(ns + "loc").Select(e => e.Value.Trim()))
                        if (Uri.TryCreate(loc, UriKind.Absolute, out var u) && siteHosts.Contains(u.Authority.ToLowerInvariant()) && urls.Count < 5000) urls.Add(loc);
                }
                else errors.Add($"{url}: not a sitemap.");
            }
            catch (Exception) { errors.Add($"{url}: could not be read as XML."); }
        }
        return new SitemapInfo(found, urls.Distinct().ToList(), errors, fetched);
    }

    // ── one page ─────────────────────────────────────────────────────────────

    private async Task<CrawledPage> FetchPageAsync(string url, int depth, HashSet<string> siteHosts, CancellationToken ct)
    {
        var r = await fetcher.FetchAsync(url, ct);
        var chain = r.Hops.Select(h => new RedirectStep(h.Url, h.Status)).ToList();
        var redirectsOnly = chain.Count > 0 && chain[^1].Status is >= 300 and < 400;

        if (r.Error is not null || !r.IsHtml || string.IsNullOrEmpty(r.Body))
            return Empty(url, r, depth, chain, r.Error ?? (redirectsOnly ? "The redirect never reached a page." : null));

        try { return await AnalyseAsync(url, r, depth, chain, siteHosts, ct); }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Could not analyse {Url}.", url);
            return Empty(url, r, depth, chain, "The page could not be read.");
        }
    }

    private static CrawledPage Empty(string url, FetchResult r, int depth, IReadOnlyList<RedirectStep> chain, string? error) => new(
        url, r.FinalUrl, r.StatusCode, chain, (int)r.ElapsedMs, r.Bytes, r.ContentType, depth, r.IsHtml,
        null, 0, null, 0, null, null, r.XRobotsTag, null, false, [], 0, 0, 0, [], [], null, null, [], [], [], 0, false, error);

    private static CrawledPage BlockedPage(string url, int depth) => new(
        url, url, 0, [], 0, 0, null, depth, false, null, 0, null, 0, null, null, null, null, false, [], 0, 0, 0, [], [], null, null, [], [], [], 0, true, null);

    private static async Task<CrawledPage> AnalyseAsync(string url, FetchResult r, int depth, IReadOnlyList<RedirectStep> chain, HashSet<string> siteHosts, CancellationToken ct)
    {
        var finalUri = new Uri(r.FinalUrl);
        using var document = await BrowsingContext.New(Configuration.Default).OpenAsync(req => req.Content(r.Body!), ct);

        static string Clean(string? s) => Regex.Replace(s ?? "", @"\s+", " ").Trim();
        string? Meta(string selector, string attr = "content") => document.QuerySelector(selector)?.GetAttribute(attr) is { } v && Clean(v).Length > 0 ? Clean(v) : null;

        var titles = document.QuerySelectorAll("title");
        var title = titles.Length > 0 ? Clean(titles[0].TextContent) : null;
        var descs = document.QuerySelectorAll("meta[name='description' i]");
        var desc = descs.Length > 0 && Clean(descs[0].GetAttribute("content")).Length > 0 ? Clean(descs[0].GetAttribute("content")) : null;

        string? canonical = null;
        var canonicalHref = document.QuerySelector("link[rel~='canonical' i]")?.GetAttribute("href");
        if (!string.IsNullOrWhiteSpace(canonicalHref) && Uri.TryCreate(finalUri, canonicalHref.Trim(), out var cu)) canonical = cu.GetLeftPart(UriPartial.Query);

        var h1s = document.QuerySelectorAll("h1").Select(h => Clean(h.TextContent)).ToList();

        // Words a visitor reads, not script or style text.
        foreach (var junk in document.QuerySelectorAll("script, style, noscript, template").ToList()) junk.Remove();
        var wordCount = Regex.Matches(document.Body?.TextContent ?? "", @"[\p{L}\p{N}]+").Count;

        var images = document.QuerySelectorAll("img").ToList();
        var missingAlt = images.Where(i => i.GetAttribute("alt") is null && !string.Equals(i.GetAttribute("role"), "presentation", StringComparison.OrdinalIgnoreCase))
            .Select(i => i.GetAttribute("src") ?? "(no src)").Take(10).ToList();

        var internalLinks = new HashSet<string>(StringComparer.Ordinal);
        var externalLinks = new HashSet<string>(StringComparer.Ordinal);
        foreach (var a in document.QuerySelectorAll("a[href]"))
        {
            var href = a.GetAttribute("href")?.Trim();
            if (string.IsNullOrEmpty(href) || href.StartsWith('#') || Regex.IsMatch(href, @"^(mailto:|tel:|javascript:|sms:|whatsapp:|data:)", RegexOptions.IgnoreCase)) continue;
            if (!Uri.TryCreate(finalUri, href, out var target) || (target.Scheme != "http" && target.Scheme != "https")) continue;
            if (siteHosts.Contains(target.Authority.ToLowerInvariant()))
            {
                if (Normalize(target.ToString(), siteHosts) is { } n && !HasAssetExtension(n)) internalLinks.Add(n);
            }
            else externalLinks.Add(target.GetLeftPart(UriPartial.Query));
        }

        var mixed = 0;
        if (finalUri.Scheme == "https")
            mixed = document.QuerySelectorAll("img[src], script[src], iframe[src], link[rel='stylesheet'][href], source[src], video[src], audio[src]")
                .Count(e => (e.GetAttribute("src") ?? e.GetAttribute("href"))?.TrimStart().StartsWith("http://", StringComparison.OrdinalIgnoreCase) == true);

        return new CrawledPage(
            url, r.FinalUrl, r.StatusCode, chain, (int)r.ElapsedMs, r.Bytes, r.ContentType, depth, true,
            title, titles.Length, desc, descs.Length, canonical, Meta("meta[name='robots' i]"), r.XRobotsTag,
            Meta("html", "lang"), document.QuerySelector("meta[name='viewport' i]") is not null, h1s, document.QuerySelectorAll("h2").Length, wordCount,
            images.Count, missingAlt, JsonLdTypes(document), Meta("meta[property='og:title']"), Meta("meta[property='og:image']"),
            document.QuerySelectorAll("link[rel='alternate'][hreflang]").Select(l => l.GetAttribute("hreflang") ?? "").Where(v => v.Length > 0).ToList(),
            internalLinks.ToList(), externalLinks.ToList(), mixed, false, null);
    }

    private static List<string> JsonLdTypes(IDocument document)
    {
        var types = new List<string>();
        foreach (var script in document.QuerySelectorAll("script[type='application/ld+json']"))
        {
            try
            {
                using var doc = JsonDocument.Parse(script.TextContent);
                void Collect(JsonElement e)
                {
                    if (e.ValueKind == JsonValueKind.Array) { foreach (var x in e.EnumerateArray()) Collect(x); return; }
                    if (e.ValueKind != JsonValueKind.Object) return;
                    if (e.TryGetProperty("@type", out var t))
                    {
                        if (t.ValueKind == JsonValueKind.String) types.Add(t.GetString()!);
                        else if (t.ValueKind == JsonValueKind.Array) types.AddRange(t.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!));
                    }
                    if (e.TryGetProperty("@graph", out var g)) Collect(g);
                }
                Collect(doc.RootElement);
            }
            catch (JsonException) { types.Add("invalid"); }
        }
        return types;
    }

    // ── external links ───────────────────────────────────────────────────────

    private async Task<IReadOnlyList<ExternalLinkResult>> CheckExternalLinksAsync(List<CrawledPage> pages, int limit, CancellationToken ct)
    {
        var sources = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var p in pages.Where(p => p.IsHtml))
            foreach (var link in p.ExternalLinks)
            {
                if (BotHostileHosts.Any(h => link.Contains("//" + h, StringComparison.OrdinalIgnoreCase) || link.Contains("." + h, StringComparison.OrdinalIgnoreCase))) continue;
                if (!sources.TryGetValue(link, out var list)) sources[link] = list = [];
                if (list.Count < 5) list.Add(p.Url);
            }

        var chosen = sources.OrderByDescending(kv => kv.Value.Count).Take(limit).ToList();
        using var gate = new SemaphoreSlim(4);
        var results = await Task.WhenAll(chosen.Select(async kv =>
        {
            await gate.WaitAsync(ct);
            try
            {
                var r = await fetcher.FetchAsync(kv.Key, ct, head: true, timeout: TimeSpan.FromSeconds(10));
                if (r.Error is null && r.StatusCode is 405 or 501 or 403) r = await fetcher.FetchAsync(kv.Key, ct, maxBytes: 20_000, timeout: TimeSpan.FromSeconds(10));
                return new ExternalLinkResult(kv.Key, r.StatusCode, r.Error, kv.Value);
            }
            finally { gate.Release(); }
        }));
        return results;
    }

    // ── URLs ─────────────────────────────────────────────────────────────────

    private static HashSet<string> SiteHosts(string domain, string finalAuthority)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { domain.ToLowerInvariant(), finalAuthority.ToLowerInvariant() };
        var bare = domain.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? domain[4..] : domain;
        set.Add(bare.ToLowerInvariant()); set.Add("www." + bare.ToLowerInvariant());
        return set;
    }

    private static bool HasAssetExtension(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) && AssetExtensions.Contains(Path.GetExtension(u.AbsolutePath));

    /// <summary>One spelling per page: no fragment, no tracking parameters, no default port, host in lower case.</summary>
    internal static string? Normalize(string url, HashSet<string> siteHosts)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || (u.Scheme != "http" && u.Scheme != "https")) return null;
        if (!siteHosts.Contains(u.Authority.ToLowerInvariant())) return null;
        var query = "";
        if (u.Query.Length > 1)
        {
            var kept = u.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Where(kv => !TrackingParams.Any(t => kv.StartsWith(t, StringComparison.OrdinalIgnoreCase))).ToList();
            if (kept.Count > 0) query = "?" + string.Join('&', kept);
        }
        return $"{u.Scheme}://{u.Authority.ToLowerInvariant()}{u.AbsolutePath}{query}";
    }
}

/// <summary>robots.txt for our own user agent (or "*"): which paths we may fetch, and which sitemaps it lists.</summary>
public sealed class RobotsRules
{
    private readonly List<(bool Allow, string Pattern)> _rules;
    public IReadOnlyList<string> Sitemaps { get; }
    public bool BlocksEverything { get; }

    public static RobotsRules AllowAll { get; } = new([], [], false);

    private RobotsRules(List<(bool, string)> rules, IReadOnlyList<string> sitemaps, bool blocksAll) { _rules = rules; Sitemaps = sitemaps; BlocksEverything = blocksAll; }

    public static RobotsRules Parse(string text)
    {
        var groups = new List<(List<string> Agents, List<(bool Allow, string Pattern)> Rules)>();
        var sitemaps = new List<string>();
        List<string>? agents = null; List<(bool, string)>? rules = null; var lastWasAgent = false;

        foreach (var raw in text.Split('\n'))
        {
            var line = raw.Split('#')[0].Trim();
            var idx = line.IndexOf(':');
            if (idx <= 0) continue;
            var key = line[..idx].Trim().ToLowerInvariant(); var value = line[(idx + 1)..].Trim();
            switch (key)
            {
                case "user-agent":
                    if (!lastWasAgent || agents is null) { agents = []; rules = []; groups.Add((agents, rules)); }
                    agents.Add(value.ToLowerInvariant()); lastWasAgent = true; break;
                case "allow": case "disallow":
                    lastWasAgent = false;
                    if (rules is not null && !(key == "disallow" && value.Length == 0)) rules.Add((key == "allow", value));
                    break;
                case "sitemap": if (Uri.TryCreate(value, UriKind.Absolute, out _)) sitemaps.Add(value); lastWasAgent = false; break;
                default: lastWasAgent = false; break;
            }
        }

        var mine = groups.Where(g => g.Agents.Any(a => a.Contains("vroduxseobot"))).SelectMany(g => g.Rules).ToList();
        var star = groups.Where(g => g.Agents.Contains("*")).SelectMany(g => g.Rules).ToList();
        var chosen = mine.Count > 0 ? mine : star;
        var blocksAll = chosen.Any(r => !r.Allow && r.Pattern == "/") && !chosen.Any(r => r.Allow);
        return new RobotsRules(chosen, sitemaps, blocksAll);
    }

    /// <summary>The longest matching rule wins; on a tie, Allow wins — the same precedence search engines use.</summary>
    public bool IsAllowed(string pathAndQuery)
    {
        (bool Allow, int Len)? best = null;
        foreach (var (allow, pattern) in _rules)
        {
            if (!Matches(pattern, pathAndQuery)) continue;
            var len = pattern.Length;
            if (best is null || len > best.Value.Len || (len == best.Value.Len && allow)) best = (allow, len);
        }
        return best?.Allow ?? true;
    }

    private static bool Matches(string pattern, string path)
    {
        var anchored = pattern.EndsWith('$');
        if (anchored) pattern = pattern[..^1];
        var regex = "^" + Regex.Escape(pattern).Replace(@"\*", ".*") + (anchored ? "$" : "");
        return Regex.IsMatch(path, regex);
    }
}
