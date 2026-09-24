namespace Softaxis.Seo.Application.Fixes.Dtos;

public sealed record FixDto(
    Guid Id, Guid IssueId, Guid SiteId, string? PageUrl, string ChangeType, string ProposedValueJson,
    string Rationale, string Status, string? ReviewedByName, DateTime? ReviewedAt, DateTime? AppliedAt, DateTime CreatedAt,
    // Denormalized issue context so the review table needs one call, not a per-row join.
    string IssueTitle, string IssueSeverity, string IssueCategory);

public sealed record RunScanNowResultDto(Guid AuditId, int IssuesFound, int FixesProposed);
