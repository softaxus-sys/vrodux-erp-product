using Softaxis.Seo.Domain.Entities;

namespace Softaxis.Seo.Infrastructure.Crawl;

/// <summary>
/// Turns one crawled page into concrete findings — deterministic, no AI involved. Detecting an issue
/// and proposing its fix are kept separate on purpose: this class is cheap, exact, and testable;
/// <c>ISeoAiAnalyzer</c> only has to write the fix, not also decide whether a problem exists.
/// </summary>
public static class SeoIssueDetector
{
    public sealed record Finding(string Category, string Severity, string Title, string Description, string? PageUrl);

    public static IReadOnlyList<Finding> Detect(CrawledPage page)
    {
        var findings = new List<Finding>();

        if (string.IsNullOrWhiteSpace(page.Title))
            findings.Add(new(SeoIssueCategories.Metadata, SeoIssueSeverities.High, "Missing page title",
                "This page has no <title> tag, which search engines rely on heavily for ranking and the result snippet.", page.Url));
        else if (page.Title.Length > 60)
            findings.Add(new(SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Title tag too long",
                $"The title is {page.Title.Length} characters — search engines typically truncate around 60.", page.Url));

        if (string.IsNullOrWhiteSpace(page.MetaDescription))
            findings.Add(new(SeoIssueCategories.Metadata, SeoIssueSeverities.Medium, "Missing meta description",
                "No meta description — search engines will auto-generate a snippet instead of the one you control.", page.Url));
        else if (page.MetaDescription.Length > 160)
            findings.Add(new(SeoIssueCategories.Metadata, SeoIssueSeverities.Low, "Meta description too long",
                $"The description is {page.MetaDescription.Length} characters — typically truncated around 160.", page.Url));

        if (string.IsNullOrWhiteSpace(page.Canonical))
            findings.Add(new(SeoIssueCategories.Technical, SeoIssueSeverities.Medium, "Missing canonical tag",
                "No canonical link — without one, duplicate/parameterised URLs can dilute ranking signals.", page.Url));

        if (!page.HasJsonLdSchema)
            findings.Add(new(SeoIssueCategories.Technical, SeoIssueSeverities.Low, "No structured data (schema.org)",
                "Adding JSON-LD structured data helps search engines understand the page and can unlock rich results.", page.Url));

        if (page.H1Count == 0)
            findings.Add(new(SeoIssueCategories.Content, SeoIssueSeverities.Medium, "Missing H1 heading",
                "The page has no H1 — a clear primary heading helps both users and search engines understand the topic.", page.Url));
        else if (page.H1Count > 1)
            findings.Add(new(SeoIssueCategories.Content, SeoIssueSeverities.Low, "Multiple H1 headings",
                $"Found {page.H1Count} H1 tags — a single, clear H1 per page is the stronger signal.", page.Url));

        if (page.ImagesMissingAlt.Count > 0)
            findings.Add(new(SeoIssueCategories.Technical, SeoIssueSeverities.Low, "Images missing alt text",
                $"{page.ImagesMissingAlt.Count} image(s) have no alt attribute, hurting accessibility and image search visibility.", page.Url));

        return findings;
    }
}
