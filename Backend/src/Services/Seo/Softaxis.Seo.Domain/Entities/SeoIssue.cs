namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// One detected problem on a site. An issue is a PERSISTENT record, not a per-scan snapshot: the same problem found by the next
/// scan updates this row (see <see cref="Observe"/>) instead of creating a duplicate, and when a scan no longer finds it the row is
/// closed as <c>resolved</c>. That is what makes "12 issues fixed this month" and a score trend possible — and it stops a
/// weekly scan from re-proposing the same AI fix every week.
/// </summary>
public sealed class SeoIssue
{
    private SeoIssue() { }

    public SeoIssue(Guid siteId, Guid auditId, string source, string category, string severity,
        string title, string description, string? pageUrl,
        string code = "", string fingerprint = "", int affectedCount = 1, string? detailsJson = null)
    {
        Id             = Guid.NewGuid();
        SiteId         = siteId;
        AuditId        = auditId;
        Source         = source;
        Category       = category;
        Severity       = severity;
        Title          = Clip(title, 300);
        Description    = Clip(description, 2000);
        PageUrl        = pageUrl is null ? null : Clip(pageUrl.Trim(), 1000);
        Code           = code;
        Fingerprint    = fingerprint;
        AffectedCount  = Math.Max(1, affectedCount);
        DetailsJson    = detailsJson;
        Status         = "open";
        DetectedAt     = DateTime.UtcNow;
        FirstSeenAt    = DetectedAt;
        LastSeenAt     = DetectedAt;
    }

    public Guid      Id          { get; private set; }
    public Guid      SiteId      { get; private set; }
    /// <summary>The scan that most recently saw this issue.</summary>
    public Guid      AuditId     { get; private set; }
    /// <summary>"crawl" | "gsc" — see <see cref="SeoIssueSources"/>.</summary>
    public string    Source      { get; private set; } = SeoIssueSources.Crawl;
    /// <summary>"technical" | "metadata" | "content" | "indexing" | "links" | "performance" — see <see cref="SeoIssueCategories"/>.</summary>
    public string    Category    { get; private set; } = SeoIssueCategories.Technical;
    public string    Severity    { get; private set; } = SeoIssueSeverities.Medium;
    public string    Title       { get; private set; } = string.Empty;
    public string    Description { get; private set; } = string.Empty;
    public string?   PageUrl     { get; private set; }
    /// <summary>Stable rule id, e.g. "title.missing". Empty on issues from before rules had ids.</summary>
    public string    Code        { get; private set; } = string.Empty;
    /// <summary>Same problem in the same place across scans: rule + page (or the duplicated text for a duplicate group). Empty = legacy.</summary>
    public string    Fingerprint { get; private set; } = string.Empty;
    /// <summary>How many pages this one finding covers (a duplicated title on 4 pages is one issue, affecting 4).</summary>
    public int       AffectedCount { get; private set; } = 1;
    /// <summary>JSON array of the affected / referring page URLs, capped.</summary>
    public string?   DetailsJson { get; private set; }
    /// <summary>open | proposed | approved | applied | dismissed | resolved</summary>
    public string    Status      { get; private set; } = "open";
    public DateTime  DetectedAt  { get; private set; }
    public DateTime  FirstSeenAt { get; private set; }
    public DateTime  LastSeenAt  { get; private set; }
    public DateTime? ResolvedAt  { get; private set; }

    public void MarkProposed() => Status = "proposed";
    public void MarkApproved() => Status = "approved";
    public void MarkApplied()  { Status = "applied"; ResolvedAt = DateTime.UtcNow; }
    public void Dismiss()      { Status = "dismissed"; ResolvedAt = DateTime.UtcNow; }

    /// <summary>The latest scan saw this exact problem again.</summary>
    public void Observe(Guid auditId, string severity, string title, string description, int affectedCount, string? detailsJson)
    {
        AuditId = auditId; Severity = severity; Title = Clip(title, 300); Description = Clip(description, 2000);
        AffectedCount = Math.Max(1, affectedCount); DetailsJson = detailsJson; LastSeenAt = DateTime.UtcNow;
    }

    /// <summary>A problem that had been closed has come back.</summary>
    public void Reopen() { Status = "open"; ResolvedAt = null; }

    /// <summary>The latest scan no longer finds it: it was fixed (by us, by the owner, or by a deploy).</summary>
    public void MarkResolved() { Status = "resolved"; ResolvedAt = DateTime.UtcNow; }

    public bool IsClosed => Status is "resolved" or "dismissed" or "applied";

    private static string Clip(string s, int max) => s.Length <= max ? s : s[..max];
}

public static class SeoIssueSources
{
    public const string Crawl = "crawl";
    public const string Gsc   = "gsc";
}

public static class SeoIssueCategories
{
    public const string Technical   = "technical";
    public const string Metadata    = "metadata";
    public const string Content     = "content";
    public const string Indexing    = "indexing";
    public const string Links       = "links";
    public const string Performance = "performance";
}

public static class SeoIssueSeverities
{
    public const string Low      = "low";
    public const string Medium   = "medium";
    public const string High     = "high";
    public const string Critical = "critical";
}
