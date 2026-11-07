namespace Softaxis.Seo.Domain.Entities;

/// <summary>A competitor website a workspace wants to be compared against. At most <see cref="Max"/> per site.</summary>
public sealed class SeoCompetitor
{
    public const int Max = 5;

    private SeoCompetitor() { }

    public SeoCompetitor(Guid siteId, string domain)
    {
        Id = Guid.NewGuid(); SiteId = siteId; Domain = Normalize(domain); CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public Guid     SiteId    { get; private set; }
    public string   Domain    { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    /// <summary>"https://www.Example.com/path" → "example.com". A leading "www." is dropped so the same site is never added twice.</summary>
    public static string Normalize(string domain)
    {
        var d = (domain ?? "").Trim().ToLowerInvariant();
        if (d.StartsWith("https://", StringComparison.Ordinal)) d = d["https://".Length..];
        else if (d.StartsWith("http://", StringComparison.Ordinal)) d = d["http://".Length..];
        var slash = d.IndexOf('/');
        if (slash >= 0) d = d[..slash];
        if (d.StartsWith("www.", StringComparison.Ordinal)) d = d[4..];
        return d.Trim();
    }
}

/// <summary>
/// The keywords a domain ranks for, as returned by the keyword data provider. Kept so a domain is only paid for once in a while
/// (the provider charges per request): a snapshot younger than the cache window is reused by every later scan.
/// </summary>
public sealed class SeoKeywordSnapshot
{
    private SeoKeywordSnapshot() { }

    public SeoKeywordSnapshot(Guid siteId, string domain, bool isOwn, int locationCode, string itemsJson, int itemCount)
    {
        Id = Guid.NewGuid(); SiteId = siteId; Domain = domain; IsOwn = isOwn; LocationCode = locationCode;
        ItemsJson = itemsJson; ItemCount = itemCount; FetchedAt = DateTime.UtcNow;
    }

    public Guid     Id           { get; private set; }
    public Guid     SiteId       { get; private set; }
    public string   Domain       { get; private set; } = string.Empty;
    public bool     IsOwn        { get; private set; }
    public int      LocationCode { get; private set; }
    public string   ItemsJson    { get; private set; } = "[]";
    public int      ItemCount    { get; private set; }
    public DateTime FetchedAt    { get; private set; }
}

public static class CompetitorScanStatuses
{
    public const string Queued = "queued", Running = "running", Completed = "completed", Failed = "failed";
}

/// <summary>One comparison run: what the competitors cover that the site does not, plus the 30-day plan built from it.</summary>
public sealed class SeoCompetitorScan
{
    private SeoCompetitorScan() { }

    public SeoCompetitorScan(Guid siteId, int locationCode, string competitorsJson)
    {
        Id = Guid.NewGuid(); SiteId = siteId; LocationCode = locationCode; CompetitorsJson = competitorsJson;
        Status = CompetitorScanStatuses.Queued; CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id                { get; private set; }
    public Guid      SiteId            { get; private set; }
    public int       LocationCode      { get; private set; }
    public string    Status            { get; private set; } = CompetitorScanStatuses.Queued;
    /// <summary>The domains compared, as they were when the scan started.</summary>
    public string    CompetitorsJson   { get; private set; } = "[]";
    public int       PagesCrawled      { get; private set; }
    public int       CreditsCharged    { get; private set; }
    /// <summary>False when no keyword provider was configured or it failed — the topic comparison still ran.</summary>
    public bool      KeywordDataUsed   { get; private set; }
    public string?   KeywordDataNote   { get; private set; }
    public string    TopicGapsJson     { get; private set; } = "[]";
    public string    KeywordGapsJson   { get; private set; } = "[]";
    public string?   Error             { get; private set; }
    public DateTime  CreatedAt         { get; private set; }
    public DateTime? StartedAt         { get; private set; }
    public DateTime? CompletedAt       { get; private set; }

    public void Start() { Status = CompetitorScanStatuses.Running; StartedAt = DateTime.UtcNow; }

    public void Complete(int pages, int credits, bool keywordData, string? note, string topicGapsJson, string keywordGapsJson)
    {
        Status = CompetitorScanStatuses.Completed; PagesCrawled = pages; CreditsCharged = credits; KeywordDataUsed = keywordData;
        KeywordDataNote = note is { Length: > 500 } ? note[..500] : note; TopicGapsJson = topicGapsJson; KeywordGapsJson = keywordGapsJson;
        CompletedAt = DateTime.UtcNow; Error = null;
    }

    public void Fail(string error)
    {
        Status = CompetitorScanStatuses.Failed; Error = error.Length > 500 ? error[..500] : error; CompletedAt = DateTime.UtcNow;
    }
}

public static class PlanItemStatuses
{
    public const string Planned = "planned", Drafted = "drafted", Skipped = "skipped";
}

/// <summary>One slot of the 30-day content calendar. A draft article is written on request, never automatically.</summary>
public sealed class SeoPlanItem
{
    private SeoPlanItem() { }

    public SeoPlanItem(Guid siteId, Guid scanId, string plannedDate, string title, string targetKeyword, string reason,
        int? searchVolume, int? difficulty, string source)
    {
        Id = Guid.NewGuid(); SiteId = siteId; ScanId = scanId; PlannedDate = plannedDate;
        Title = Cut(title, 300); TargetKeyword = Cut(targetKeyword, 200); Reason = Cut(reason, 600);
        SearchVolume = searchVolume; Difficulty = difficulty; Source = source; Status = PlanItemStatuses.Planned; CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public Guid     SiteId        { get; private set; }
    public Guid     ScanId        { get; private set; }
    /// <summary>A calendar day, yyyy-MM-dd.</summary>
    public string   PlannedDate   { get; private set; } = string.Empty;
    public string   Title         { get; private set; } = string.Empty;
    public string   TargetKeyword { get; private set; } = string.Empty;
    public string   Reason        { get; private set; } = string.Empty;
    public int?     SearchVolume  { get; private set; }
    public int?     Difficulty    { get; private set; }
    /// <summary>"keyword" (backed by search volume) or "topic" (backed by what competitors publish).</summary>
    public string   Source        { get; private set; } = "keyword";
    public string   Status        { get; private set; } = PlanItemStatuses.Planned;
    public Guid?    ArticleId     { get; private set; }
    public DateTime CreatedAt     { get; private set; }

    public void MarkDrafted(Guid articleId) { ArticleId = articleId; Status = PlanItemStatuses.Drafted; }
    public void Skip() { Status = PlanItemStatuses.Skipped; }

    private static string Cut(string s, int max) => string.IsNullOrWhiteSpace(s) ? "" : s.Trim().Length > max ? s.Trim()[..max] : s.Trim();
}
