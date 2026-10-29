using Microsoft.Extensions.Configuration;

namespace Softaxis.Seo.Infrastructure.Crawl;

/// <summary>Tunable limits. Defaults are what a customer is charged against; see <c>Seo:*</c> in configuration.</summary>
public sealed class SeoOptions
{
    /// <summary>One credit buys this many crawled pages.</summary>
    public int PagesPerCredit { get; init; } = 25;
    /// <summary>The most pages one audit will check, however many credits there are.</summary>
    public int MaxPagesPerAudit { get; init; } = 500;
    public int WelcomeCredits { get; init; } = 20;
    public int CrawlConcurrency { get; init; } = 4;
    /// <summary>Different external addresses checked for broken links per audit.</summary>
    public int ExternalLinkCheckLimit { get; init; } = 60;

    public static SeoOptions From(IConfiguration c)
    {
        var s = c.GetSection("Seo");
        int Pick(string key, int fallback, int min, int max) => Math.Clamp(s.GetValue<int?>(key) ?? fallback, min, max);
        return new SeoOptions
        {
            PagesPerCredit = Pick("PagesPerCredit", 25, 1, 1000),
            MaxPagesPerAudit = Pick("MaxPagesPerAudit", 500, 10, 5000),
            WelcomeCredits = Pick("WelcomeCredits", 20, 0, 100000),
            CrawlConcurrency = Pick("CrawlConcurrency", 4, 1, 8),
            ExternalLinkCheckLimit = Pick("ExternalLinkCheckLimit", 60, 0, 300),
        };
    }

    public int CreditsFor(int pages) => Math.Max(1, (int)Math.Ceiling(pages / (double)PagesPerCredit));
}

public sealed record RedirectStep(string Url, int Status);

/// <summary>Everything one page tells a search engine, as a crawler sees it.</summary>
public sealed record CrawledPage(
    string Url, string FinalUrl, int StatusCode, IReadOnlyList<RedirectStep> RedirectChain, int ResponseMs, int HtmlBytes, string? ContentType, int Depth,
    bool IsHtml, string? Title, int TitleCount, string? MetaDescription, int MetaDescriptionCount, string? Canonical, string? RobotsMeta, string? XRobotsTag,
    string? Lang, bool HasViewport, IReadOnlyList<string> H1s, int H2Count, int WordCount, int ImageCount, IReadOnlyList<string> ImagesMissingAlt,
    IReadOnlyList<string> JsonLdTypes, string? OgTitle, string? OgImage, IReadOnlyList<string> Hreflangs,
    IReadOnlyList<string> InternalLinks, IReadOnlyList<string> ExternalLinks, int MixedContentCount, bool BlockedByRobots, string? Error)
{
    public bool HasJsonLdSchema => JsonLdTypes.Count > 0;
    public int H1Count => H1s.Count;
    public bool Noindex =>
        (RobotsMeta?.Contains("noindex", StringComparison.OrdinalIgnoreCase) ?? false) || (XRobotsTag?.Contains("noindex", StringComparison.OrdinalIgnoreCase) ?? false);
    public bool Ok => Error is null && StatusCode is >= 200 and < 300;
    public string Metric => FinalUrl;
}

public sealed record RobotsInfo(bool Found, int Status, bool BlocksEverything, IReadOnlyList<string> Sitemaps, string? Error);

public sealed record SitemapInfo(bool Found, IReadOnlyList<string> Urls, IReadOnlyList<string> Errors, int Fetched);

public sealed record ExternalLinkResult(string Url, int Status, string? Error, IReadOnlyList<string> Sources)
{
    public bool Broken => Error is not null || Status is 404 or 410 or >= 500;
}

public sealed record CrawlResult(
    string Domain, string BaseUrl, string Host, IReadOnlyList<CrawledPage> Pages, RobotsInfo Robots, SitemapInfo Sitemap,
    IReadOnlyList<ExternalLinkResult> ExternalLinks, bool HttpsEnforced, bool HttpChecked, bool Truncated, int Discovered, long DurationMs);
