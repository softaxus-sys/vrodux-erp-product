namespace Softaxis.Seo.Domain.Entities;

/// <summary>One scan run for a site — the crawl + GSC-data pull + AI-analysis pass that produces
/// <see cref="SeoIssue"/>/<see cref="SeoFix"/> rows.</summary>
public sealed class SeoAudit
{
    private SeoAudit() { }

    public SeoAudit(Guid siteId)
    {
        Id        = Guid.NewGuid();
        SiteId    = siteId;
        Status    = "running";
        StartedAt = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      SiteId        { get; private set; }
    public string    Status        { get; private set; } = "running"; // running | completed | failed
    public DateTime  StartedAt     { get; private set; }
    public DateTime? CompletedAt   { get; private set; }
    public int       IssuesFound   { get; private set; }
    public int       FixesProposed { get; private set; }
    public string?   Error         { get; private set; }

    public void Complete(int issuesFound, int fixesProposed)
    {
        Status = "completed";
        CompletedAt = DateTime.UtcNow;
        IssuesFound = issuesFound;
        FixesProposed = fixesProposed;
    }

    public void Fail(string error)
    {
        Status = "failed";
        CompletedAt = DateTime.UtcNow;
        Error = error.Length > 1000 ? error[..1000] : error;
    }
}
