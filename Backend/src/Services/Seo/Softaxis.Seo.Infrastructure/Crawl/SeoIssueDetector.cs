using System.Security.Cryptography;
using System.Text;
using Softaxis.Seo.Domain.Entities;

namespace Softaxis.Seo.Infrastructure.Crawl;

/// <summary>
/// Turns a crawl into concrete findings — deterministic, no AI involved. Detecting a problem and proposing its fix are kept separate
/// on purpose: this class is cheap, exact and unit-tested; <c>ISeoAiAnalyzer</c> only writes the fix.
/// Each finding has a stable <see cref="Finding.Fingerprint"/> so the next scan recognises the same problem instead of recording it again.
/// </summary>
public static class SeoIssueDetector
{
    /// <param name="Affected">Pages this finding covers (1 for a page rule, the group size for duplicates, the number of links for a site rule).</param>
    /// <param name="Details">Affected or referring URLs, capped.</param>
    public sealed record Finding(string Code, string Category, string Severity, string Title, string Description, string? PageUrl, int Affected, IReadOnlyList<string> Details, string Fingerprint);

    private const int SlowMs = 1500, VerySlowMs = 4000, LargeBytes = 1_000_000, ThinWords = 150;

    public static IReadOnlyList<Finding> Detect(CrawlResult crawl)
    {
        var f = new List<Finding>();
        var pages = crawl.Pages;
        var html = pages.Where(p => p.IsHtml && p.Error is null && !p.BlockedByRobots).ToList();
        // A URL that redirects shows its destination's content: judging it too would count one page twice (and fake a duplicate title).
        var good = html.Where(p => p.StatusCode is >= 200 and < 300 && p.FinalUrl == p.Url).ToList();
        var indexable = good.Where(p => !p.Noindex).ToList();

        // ── Status codes, redirects, broken links ────────────────────────────
        foreach (var p in pages.Where(p => !p.BlockedByRobots && p.Error is null && p.StatusCode >= 500))
            f.Add(Page("status.server-error", SeoIssueCategories.Technical, SeoIssueSeverities.High, "Page returns a server error",
                $"This page answered with HTTP {p.StatusCode}. Search engines drop pages that keep failing.", p.Url));

        var brokenTargets = pages.Where(p => !p.BlockedByRobots && p.Error is null && p.StatusCode is 404 or 410).Select(p => p.Url).ToHashSet(StringComparer.Ordinal);
        brokenTargets.UnionWith(pages.Where(p => p.Error is not null && !p.BlockedByRobots && p.StatusCode == 0).Select(p => p.Url));
        foreach (var target in brokenTargets.Take(200))
        {
            var sources = good.Where(p => p.InternalLinks.Contains(target)).Select(p => p.Url).ToList();
            var status = pages.First(p => p.Url == target);
            f.Add(new Finding("link.broken-internal", SeoIssueCategories.Links, SeoIssueSeverities.High, "Broken internal link",
                $"{target} does not load ({(status.StatusCode > 0 ? "HTTP " + status.StatusCode : status.Error)}). " +
                (sources.Count > 0 ? $"{sources.Count} page(s) link to it." : "It was found in the sitemap."),
                target, Math.Max(1, sources.Count), sources.Take(20).ToList(), Fp("link.broken-internal", target)));
        }

        foreach (var p in pages.Where(p => !p.BlockedByRobots && p.RedirectChain.Count(h => h.Status is >= 300 and < 400) >= 2 && p.Error is null))
            f.Add(Page("redirect.chain", SeoIssueCategories.Technical, SeoIssueSeverities.Medium, "Redirect chain",
                $"This address redirects {p.RedirectChain.Count(h => h.Status is >= 300 and < 400)} times before reaching the page. Each hop wastes crawl budget and loses a little ranking value.", p.Url));
        foreach (var p in pages.Where(p => p.Error is "Redirect loop." or "Too many redirects."))
            f.Add(Page("redirect.loop", SeoIssueCategories.Technical, SeoIssueSeverities.Critical, "Redirect loop",
                "This address redirects in a circle and never reaches a page.", p.Url));

        // Internal links that point at an address that redirects: link straight to the destination.
        var redirecting = pages.Where(p => p.RedirectChain.Any(h => h.Status is >= 300 and < 400) && p.Error is null && p.FinalUrl != p.Url).Select(p => p.Url).ToHashSet(StringComparer.Ordinal);
        foreach (var target in redirecting.Take(100))
        {
            var sources = good.Where(p => p.InternalLinks.Contains(target)).Select(p => p.Url).ToList();
            if (sources.Count == 0) continue;
            f.Add(new Finding("redirect.internal-link", SeoIssueCategories.Links, SeoIssueSeverities.Low, "Internal link goes through a redirect",
                $"{sources.Count} page(s) link to {target}, which redirects. Linking directly to the final address is faster and cleaner.",
                target, sources.Count, sources.Take(20).ToList(), Fp("redirect.internal-link", target)));
        }

        foreach (var e in crawl.ExternalLinks.Where(e => e.Broken))
            f.Add(new Finding("link.broken-external", SeoIssueCategories.Links, SeoIssueSeverities.Medium, "Broken outbound link",
                $"{e.Url} does not load ({(e.Status > 0 ? "HTTP " + e.Status : e.Error)}). Linking to dead pages looks neglected to visitors and search engines.",
                e.Sources.FirstOrDefault(), e.Sources.Count, e.Sources, Fp("link.broken-external", e.Url)));

        // ── Per page: metadata ───────────────────────────────────────────────
        foreach (var p in indexable)
        {
            if (string.IsNullOrWhiteSpace(p.Title))
                f.Add(Page("title.missing", SeoIssueCategories.Metadata, SeoIssueSeverities.High, "Missing page title",
                    "This page has no <title> tag, which search engines rely on heavily for ranking and the result snippet.", p.Url));
            else
            {
                if (p.Title.Length > 60) f.Add(Page("title.long", SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Title tag too long",
                    $"The title is {p.Title.Length} characters — search engines typically truncate around 60.", p.Url));
                else if (p.Title.Length < 20) f.Add(Page("title.short", SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Title tag too short",
                    $"The title is only {p.Title.Length} characters; a descriptive title of 30–60 characters ranks and reads better.", p.Url));
                if (p.TitleCount > 1) f.Add(Page("title.multiple", SeoIssueCategories.Metadata, SeoIssueSeverities.Medium, "More than one title tag",
                    $"The page has {p.TitleCount} <title> tags; search engines may pick the wrong one.", p.Url));
            }

            if (string.IsNullOrWhiteSpace(p.MetaDescription))
                f.Add(Page("desc.missing", SeoIssueCategories.Metadata, SeoIssueSeverities.Medium, "Missing meta description",
                    "No meta description — search engines will auto-generate a snippet instead of the one you control.", p.Url));
            else if (p.MetaDescription.Length > 160)
                f.Add(Page("desc.long", SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Meta description too long",
                    $"The description is {p.MetaDescription.Length} characters — typically truncated around 160.", p.Url));
            else if (p.MetaDescription.Length < 70)
                f.Add(Page("desc.short", SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Meta description too short",
                    $"The description is only {p.MetaDescription.Length} characters; 120–160 uses the space you are given.", p.Url));

            if (string.IsNullOrWhiteSpace(p.Canonical))
                f.Add(Page("canonical.missing", SeoIssueCategories.Technical, SeoIssueSeverities.Medium, "Missing canonical tag",
                    "No canonical link — without one, duplicate or parameterised URLs can dilute ranking signals.", p.Url));
            else if (Uri.TryCreate(p.Canonical, UriKind.Absolute, out var cu) && !SameSite(cu.Host, crawl.Host, crawl.Domain))
                f.Add(Page("canonical.other-host", SeoIssueCategories.Technical, SeoIssueSeverities.High, "Canonical points to another website",
                    $"The canonical is {p.Canonical}. This tells search engines to rank that site's page instead of this one.", p.Url));

            if (!p.HasJsonLdSchema)
                f.Add(Page("schema.missing", SeoIssueCategories.Technical, SeoIssueSeverities.Low, "No structured data (schema.org)",
                    "Adding JSON-LD structured data helps search engines understand the page and can unlock rich results.", p.Url));
            else if (p.JsonLdTypes.Contains("invalid"))
                f.Add(Page("schema.invalid", SeoIssueCategories.Technical, SeoIssueSeverities.Medium, "Structured data cannot be read",
                    "A JSON-LD block on this page is not valid JSON, so search engines ignore it.", p.Url));

            if (p.H1Count == 0)
                f.Add(Page("h1.missing", SeoIssueCategories.Content, SeoIssueSeverities.Medium, "Missing H1 heading",
                    "The page has no H1 — a clear primary heading helps both users and search engines understand the topic.", p.Url));
            else if (p.H1Count > 1)
                f.Add(Page("h1.multiple", SeoIssueCategories.Content, SeoIssueSeverities.Low, "Multiple H1 headings",
                    $"Found {p.H1Count} H1 tags — a single, clear H1 per page is the stronger signal.", p.Url));
            else if (string.IsNullOrWhiteSpace(p.H1s[0]))
                f.Add(Page("h1.empty", SeoIssueCategories.Content, SeoIssueSeverities.Medium, "Empty H1 heading", "The H1 exists but has no text.", p.Url));

            if (p.ImagesMissingAlt.Count > 0)
                f.Add(Page("alt.missing", SeoIssueCategories.Technical, SeoIssueSeverities.Low, "Images missing alt text",
                    $"{p.ImagesMissingAlt.Count} image(s) have no alt attribute, hurting accessibility and image search visibility.", p.Url));

            if (string.IsNullOrWhiteSpace(p.Lang))
                f.Add(Page("lang.missing", SeoIssueCategories.Technical, SeoIssueSeverities.Low, "No language declared",
                    "The <html> tag has no lang attribute; search engines and screen readers use it to serve the right audience.", p.Url));
            if (!p.HasViewport)
                f.Add(Page("viewport.missing", SeoIssueCategories.Technical, SeoIssueSeverities.Medium, "No mobile viewport",
                    "Without a viewport meta tag the page is not mobile-friendly, and Google ranks mobile-first.", p.Url));
            if (string.IsNullOrWhiteSpace(p.OgTitle) || string.IsNullOrWhiteSpace(p.OgImage))
                f.Add(Page("og.missing", SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Incomplete social sharing tags",
                    "Open Graph title/image are missing, so links shared on social networks show a plain, unattractive preview.", p.Url));

            if (p.WordCount < ThinWords)
                f.Add(Page("content.thin", SeoIssueCategories.Content, SeoIssueSeverities.Medium, "Thin content",
                    $"Only {p.WordCount} words of visible text. Pages with very little content rarely rank.", p.Url));

            if (p.ResponseMs >= VerySlowMs)
                f.Add(Page("perf.very-slow", SeoIssueCategories.Performance, SeoIssueSeverities.High, "Very slow response",
                    $"The server took {p.ResponseMs / 1000.0:0.0}s to answer. Slow pages lose visitors and ranking.", p.Url));
            else if (p.ResponseMs >= SlowMs)
                f.Add(Page("perf.slow", SeoIssueCategories.Performance, SeoIssueSeverities.Medium, "Slow response",
                    $"The server took {p.ResponseMs / 1000.0:0.0}s to answer; under 1s is the goal.", p.Url));
            if (p.HtmlBytes >= LargeBytes)
                f.Add(Page("perf.large", SeoIssueCategories.Performance, SeoIssueSeverities.Low, "Very large page",
                    $"The page HTML alone is {p.HtmlBytes / 1024} KB.", p.Url));

            if (p.MixedContentCount > 0)
                f.Add(Page("link.mixed-content", SeoIssueCategories.Technical, SeoIssueSeverities.Medium, "Insecure content on a secure page",
                    $"{p.MixedContentCount} resource(s) load over http on this https page; browsers block or warn about them.", p.Url));
            if (p.Depth >= 5)
                f.Add(Page("depth.deep", SeoIssueCategories.Technical, SeoIssueSeverities.Low, "Page is deep in the site",
                    $"It takes {p.Depth} clicks from the homepage to reach this page; important pages should be within 3–4.", p.Url));
        }

        foreach (var p in good.Where(p => p.Noindex && p.InternalLinksInSitemap(crawl)))
            f.Add(Page("index.noindex", SeoIssueCategories.Indexing, SeoIssueSeverities.High, "Page in the sitemap is set to noindex",
                "It is listed in the sitemap but told search engines not to index it — the two instructions contradict each other.", p.Url));

        // ── Duplicates ───────────────────────────────────────────────────────
        AddDuplicates(f, indexable, p => p.Title, "dup.title", "Duplicate page title", "pages share the title");
        AddDuplicates(f, indexable, p => p.MetaDescription, "dup.desc", "Duplicate meta description", "pages share the description");
        AddDuplicates(f, indexable, p => p.H1s.FirstOrDefault(), "dup.h1", "Duplicate H1 heading", "pages share the H1");

        // ── Orphans: in the sitemap but nothing links to them ────────────────
        if (crawl.Sitemap.Found)
        {
            var linked = good.SelectMany(p => p.InternalLinks).ToHashSet(StringComparer.Ordinal);
            foreach (var p in indexable.Where(p => p.Depth > 0 && !linked.Contains(p.Url)).Take(100))
                f.Add(Page("page.orphan", SeoIssueCategories.Indexing, SeoIssueSeverities.Low, "Orphan page",
                    "Listed in the sitemap but no other page links to it, so visitors and crawlers can hardly reach it.", p.Url));
        }

        // ── Whole site ───────────────────────────────────────────────────────
        if (crawl.HttpChecked && !crawl.HttpsEnforced)
            f.Add(Site("https.not-enforced", SeoIssueCategories.Technical, SeoIssueSeverities.High, "http:// does not redirect to https://",
                "Visitors who type the plain http address stay on the insecure version. Redirect everything to https."));
        if (!crawl.Robots.Found)
            f.Add(Site("robots.missing", SeoIssueCategories.Indexing, SeoIssueSeverities.Low, "No robots.txt",
                "There is no robots.txt file. It is optional, but it is where you point crawlers at your sitemap."));
        if (crawl.Robots.BlocksEverything)
            f.Add(Site("robots.blocks-all", SeoIssueCategories.Indexing, SeoIssueSeverities.Critical, "robots.txt blocks the whole site",
                "robots.txt contains 'Disallow: /', which tells search engines not to crawl any page. Remove it if the site should appear in search."));
        if (!crawl.Sitemap.Found)
            f.Add(Site("sitemap.missing", SeoIssueCategories.Indexing, SeoIssueSeverities.Medium, "No XML sitemap found",
                "Without a sitemap search engines find pages only by following links. Add /sitemap.xml and list it in robots.txt."));
        else
        {
            var bad = crawl.Sitemap.Urls.Where(u => pages.FirstOrDefault(p => p.Url == u) is { } p && (p.StatusCode >= 400 || p.Error is not null)).ToList();
            if (bad.Count > 0)
                f.Add(new Finding("sitemap.bad-urls", SeoIssueCategories.Indexing, SeoIssueSeverities.Medium, "Sitemap lists pages that do not load",
                    $"{bad.Count} address(es) in the sitemap return an error. A sitemap should list only live, indexable pages.", null, bad.Count, bad.Take(20).ToList(), Fp("sitemap.bad-urls", "")));
        }
        if (crawl.Truncated)
            f.Add(Site("crawl.limit", SeoIssueCategories.Technical, SeoIssueSeverities.Low, "Not every page was checked",
                $"The site has more pages than one audit covers ({crawl.Pages.Count(p => !p.BlockedByRobots)} checked, {crawl.Discovered} found). Run another audit after raising your page limit to cover the rest."));

        return Dedupe(f);
    }

    private static bool InternalLinksInSitemap(this CrawledPage p, CrawlResult crawl) => crawl.Sitemap.Urls.Contains(p.Url) || crawl.Sitemap.Urls.Contains(p.FinalUrl);

    private static void AddDuplicates(List<Finding> into, List<CrawledPage> pages, Func<CrawledPage, string?> pick, string code, string title, string phrase)
    {
        foreach (var g in pages.Select(p => (Page: p, Text: (pick(p) ?? "").Trim())).Where(x => x.Text.Length > 0)
                     .GroupBy(x => x.Text.ToLowerInvariant()).Where(g => g.Count() > 1))
        {
            var urls = g.Select(x => x.Page.Url).OrderBy(u => u, StringComparer.Ordinal).ToList();
            var text = g.First().Text;
            into.Add(new Finding(code, SeoIssueCategories.Metadata, SeoIssueSeverities.Medium, title,
                $"{urls.Count} {phrase} “{(text.Length > 80 ? text[..80] + "…" : text)}”. Each page needs its own, so search engines can tell them apart.",
                urls[0], urls.Count, urls.Take(20).ToList(), Fp(code, g.Key)));
        }
    }

    private static List<Finding> Dedupe(List<Finding> all) => all.GroupBy(x => x.Fingerprint).Select(g => g.First()).ToList();

    private static Finding Page(string code, string category, string severity, string title, string description, string url) =>
        new(code, category, severity, title, description, url, 1, [url], Fp(code, url));

    private static Finding Site(string code, string category, string severity, string title, string description) =>
        new(code, category, severity, title, description, null, 1, [], Fp(code, ""));

    private static bool SameSite(string host, string siteHost, string domain)
    {
        static string Bare(string h) { h = h.ToLowerInvariant(); var i = h.IndexOf(':'); if (i > 0) h = h[..i]; return h.StartsWith("www.") ? h[4..] : h; }
        return Bare(host) == Bare(siteHost) || Bare(host) == Bare(domain);
    }

    /// <summary>Stable identity of a problem: the rule plus where it is. Short enough to index, long enough not to collide.</summary>
    public static string Fp(string code, string key)
    {
        var norm = key.Trim().ToLowerInvariant().TrimEnd('/');
        if (norm.Length <= 120) return $"{code}|{norm}";
        return $"{code}|{Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(norm)))[..24]}";
    }
}

/// <summary>
/// The 0–100 health score of an audit. Each rule costs points by severity; how many points depends on how widespread it is, so one
/// missing alt text on a 200-page site costs far less than the same flaw on every page, but a flaw never costs nothing. Rules are
/// scored once however many pages they hit, so a 10,000-page site is not marked down more for being large.
/// </summary>
public static class SeoScore
{
    private static readonly HashSet<string> Informational = ["crawl.limit"];

    public static int Compute(IEnumerable<SeoIssueDetector.Finding> findings, int pagesCrawled)
    {
        var pages = Math.Max(1, pagesCrawled);
        var penalty = 0.0;
        foreach (var g in findings.Where(f => !Informational.Contains(f.Code)).GroupBy(f => f.Code))
        {
            var weight = Weight(g.First().Severity);
            var affected = g.Sum(f => f.Affected);
            penalty += weight * Math.Min(1.0, 0.25 + affected / (double)pages);
        }
        return (int)Math.Clamp(Math.Round(100 - penalty), 0, 100);
    }

    public static double Weight(string severity) => severity switch
    {
        SeoIssueSeverities.Critical => 18, SeoIssueSeverities.High => 9, SeoIssueSeverities.Medium => 4, _ => 1.5,
    };
}
