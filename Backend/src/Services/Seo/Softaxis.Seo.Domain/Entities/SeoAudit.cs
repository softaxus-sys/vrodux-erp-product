namespace Softaxis.Seo.Domain.Entities;

/// <summary>One audit of a site: the crawl, the findings, the score. Each completed audit is a point on the site's health trend.</summary>
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
    /// <summary>Open problems on the site when this audit finished.</summary>
    public int       IssuesFound   { get; private set; }
    public int       FixesProposed { get; private set; }
    public string?   Error         { get; private set; }

    /// <summary>0–100, see <c>SeoScore</c>. Null while running or on failure.</summary>
    public int?      Score         { get; private set; }
    public int       PagesCrawled  { get; private set; }
    public int       CriticalCount { get; private set; }
    public int       HighCount     { get; private set; }
    public int       MediumCount   { get; private set; }
    public int       LowCount      { get; private set; }
    /// <summary>Problems this audit found that were not open before (new, or come back).</summary>
    public int       NewIssues     { get; private set; }
    /// <summary>Problems the previous audit had that this one no longer finds.</summary>
    public int       ResolvedIssues { get; private set; }
    public int       CreditsCharged { get; private set; }
    public long      DurationMs    { get; private set; }
    /// <summary>The crawl hit its page limit — there are more pages than were checked.</summary>
    public bool      Truncated     { get; private set; }

    /// <param name="note">Non-fatal — e.g. "AI not configured, fixes were not proposed." The audit still completed and its issues stand.</param>
    public void Complete(AuditOutcome o, string? note = null)
    {
        Status = "completed"; CompletedAt = DateTime.UtcNow;
        IssuesFound = o.OpenIssues; FixesProposed = o.FixesProposed; Score = o.Score; PagesCrawled = o.PagesCrawled;
        CriticalCount = o.Critical; HighCount = o.High; MediumCount = o.Medium; LowCount = o.Low;
        NewIssues = o.NewIssues; ResolvedIssues = o.ResolvedIssues; CreditsCharged = o.CreditsCharged; DurationMs = o.DurationMs; Truncated = o.Truncated;
        Error = note is { Length: > 1000 } ? note[..1000] : note;
    }

    public void Fail(string error)
    {
        Status = "failed";
        CompletedAt = DateTime.UtcNow;
        Error = error.Length > 1000 ? error[..1000] : error;
    }
}

public sealed record AuditOutcome(
    int OpenIssues, int FixesProposed, int Score, int PagesCrawled, int Critical, int High, int Medium, int Low,
    int NewIssues, int ResolvedIssues, int CreditsCharged, long DurationMs, bool Truncated);
