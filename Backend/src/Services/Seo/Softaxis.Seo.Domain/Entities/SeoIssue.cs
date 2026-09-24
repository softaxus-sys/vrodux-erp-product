namespace Softaxis.Seo.Domain.Entities;

/// <summary>One detected problem, from either our own crawl or Google Search Console's own
/// coverage/Core Web Vitals data (better data than a simple crawler can produce for those categories).</summary>
public sealed class SeoIssue
{
    private SeoIssue() { }

    public SeoIssue(Guid siteId, Guid auditId, string source, string category, string severity,
        string title, string description, string? pageUrl)
    {
        Id          = Guid.NewGuid();
        SiteId      = siteId;
        AuditId     = auditId;
        Source      = source;
        Category    = category;
        Severity    = severity;
        Title       = title.Trim();
        Description = description.Trim();
        PageUrl     = pageUrl?.Trim();
        Status      = "open";
        DetectedAt  = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public Guid      SiteId      { get; private set; }
    public Guid      AuditId     { get; private set; }
    /// <summary>"crawl" | "gsc" — see <see cref="SeoIssueSources"/>.</summary>
    public string    Source      { get; private set; } = SeoIssueSources.Crawl;
    /// <summary>"technical" | "metadata" | "content" | "indexing" — see <see cref="SeoIssueCategories"/>.</summary>
    public string    Category    { get; private set; } = SeoIssueCategories.Technical;
    public string    Severity    { get; private set; } = SeoIssueSeverities.Medium;
    public string    Title       { get; private set; } = string.Empty;
    public string    Description { get; private set; } = string.Empty;
    public string?   PageUrl     { get; private set; }
    /// <summary>open | proposed | approved | applied | dismissed</summary>
    public string    Status      { get; private set; } = "open";
    public DateTime  DetectedAt  { get; private set; }
    public DateTime? ResolvedAt  { get; private set; }

    public void MarkProposed() => Status = "proposed";
    public void MarkApproved() => Status = "approved";
    public void MarkApplied()  { Status = "applied"; ResolvedAt = DateTime.UtcNow; }
    public void Dismiss()      { Status = "dismissed"; ResolvedAt = DateTime.UtcNow; }
}

public static class SeoIssueSources
{
    public const string Crawl = "crawl";
    public const string Gsc   = "gsc";
}

public static class SeoIssueCategories
{
    public const string Technical = "technical";
    public const string Metadata  = "metadata";
    public const string Content   = "content";
    public const string Indexing  = "indexing";
}

public static class SeoIssueSeverities
{
    public const string Low      = "low";
    public const string Medium   = "medium";
    public const string High     = "high";
    public const string Critical = "critical";
}
