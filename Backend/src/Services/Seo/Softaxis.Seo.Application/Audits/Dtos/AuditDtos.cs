namespace Softaxis.Seo.Application.Audits.Dtos;

public sealed record AuditDto(
    Guid Id, Guid SiteId, string Status, DateTime StartedAt, DateTime? CompletedAt,
    int IssuesFound, int FixesProposed, string? Error,
    int? Score = null, int PagesCrawled = 0, int CriticalCount = 0, int HighCount = 0, int MediumCount = 0, int LowCount = 0,
    int NewIssues = 0, int ResolvedIssues = 0, int CreditsCharged = 0, long DurationMs = 0, bool Truncated = false);

public sealed record IssueDto(
    Guid Id, Guid SiteId, Guid AuditId, string Source, string Category, string Severity,
    string Title, string Description, string? PageUrl, string Status, DateTime DetectedAt,
    string Code = "", int AffectedCount = 1, string? DetailsJson = null, DateTime? FirstSeenAt = null, DateTime? LastSeenAt = null, DateTime? ResolvedAt = null);

public sealed record PageDto(
    Guid Id, Guid AuditId, string Url, string? FinalUrl, int StatusCode, int RedirectHops, int ResponseMs, int HtmlBytes, int Depth,
    string? Title, string? MetaDescription, string? H1, int WordCount, bool Indexable, bool InSitemap, int InternalLinksIn, int InternalLinksOut,
    int IssueCount, string? Error);
