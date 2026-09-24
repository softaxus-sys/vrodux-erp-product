namespace Softaxis.Seo.Application.Audits.Dtos;

public sealed record AuditDto(
    Guid Id, Guid SiteId, string Status, DateTime StartedAt, DateTime? CompletedAt,
    int IssuesFound, int FixesProposed, string? Error);

public sealed record IssueDto(
    Guid Id, Guid SiteId, Guid AuditId, string Source, string Category, string Severity,
    string Title, string Description, string? PageUrl, string Status, DateTime DetectedAt);
