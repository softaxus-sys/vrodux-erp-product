namespace Softaxis.Seo.Domain.Entities;

/// <summary>
/// One page as an audit found it. Kept for the last few audits of a site so the pages table can be shown, sorted and compared; older
/// audits keep their score and counts (on <see cref="SeoAudit"/>) but not their page rows.
/// </summary>
public sealed class SeoPage
{
    private SeoPage() { }

    public SeoPage(Guid auditId, Guid siteId, string url)
    {
        Id = Guid.NewGuid(); AuditId = auditId; SiteId = siteId; Url = url.Length > 1000 ? url[..1000] : url;
    }

    public Guid    Id            { get; private set; }
    public Guid    AuditId       { get; private set; }
    public Guid    SiteId        { get; private set; }
    public string  Url           { get; private set; } = string.Empty;
    /// <summary>Where the request ended up after redirects, when different.</summary>
    public string? FinalUrl      { get; set; }
    public int     StatusCode    { get; set; }
    public int     RedirectHops  { get; set; }
    public int     ResponseMs    { get; set; }
    public int     HtmlBytes     { get; set; }
    public int     Depth         { get; set; }
    public string? Title         { get; set; }
    public string? MetaDescription { get; set; }
    public string? H1            { get; set; }
    public int     WordCount     { get; set; }
    public bool    Indexable     { get; set; } = true;
    public bool    InSitemap     { get; set; }
    public int     InternalLinksIn  { get; set; }
    public int     InternalLinksOut { get; set; }
    /// <summary>Findings on this page in this audit.</summary>
    public int     IssueCount    { get; set; }
    public string? Error         { get; set; }
}

/// <summary>A workspace's SEO credit balance, changed only by the guarded statements in <c>SeoCreditService</c>.</summary>
public sealed class SeoWallet
{
    private SeoWallet() { }
    public static SeoWallet CreateEmpty() => new() { Id = Guid.NewGuid() };

    public Guid     Id             { get; private set; }
    public long     Balance        { get; private set; }
    public long     LifetimeAdded  { get; private set; }
    public long     LifetimeSpent  { get; private set; }
    /// <summary>The one-time welcome grant has been given.</summary>
    public bool     WelcomeGranted { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt     { get; private set; }
}

/// <summary>Every credit movement. Amount is signed: grants and refunds are positive, spend is negative.</summary>
public sealed class SeoCreditEntry
{
    private SeoCreditEntry() { }

    public SeoCreditEntry(string type, int amount, long balanceAfter, string reason, string? refType, Guid? refId, string idempotencyKey, string? actorName)
    {
        Id = Guid.NewGuid(); Type = type; Amount = amount; BalanceAfter = balanceAfter;
        Reason = reason.Length > 300 ? reason[..300] : reason; RefType = refType; RefId = refId; IdempotencyKey = idempotencyKey; ActorName = actorName;
    }

    public Guid     Id             { get; private set; }
    /// <summary>grant | spend | refund | adjustment</summary>
    public string   Type           { get; private set; } = string.Empty;
    public int      Amount         { get; private set; }
    public long     BalanceAfter   { get; private set; }
    public string   Reason         { get; private set; } = string.Empty;
    public string?  RefType        { get; private set; }
    public Guid?    RefId          { get; private set; }
    /// <summary>Unique per workspace: a retried request or restarted job cannot post twice.</summary>
    public string   IdempotencyKey { get; private set; } = string.Empty;
    public string?  ActorName      { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;
}

public static class SeoCreditTypes
{
    public const string Grant = "grant", Spend = "spend", Refund = "refund", Adjustment = "adjustment",
        Purchase = "purchase", SwapIn = "swap_in", SwapOut = "swap_out";
}
