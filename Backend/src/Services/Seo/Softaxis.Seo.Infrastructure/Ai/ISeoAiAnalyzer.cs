namespace Softaxis.Seo.Infrastructure.Ai;

public interface ISeoAiAnalyzer
{
    Task<IReadOnlyList<ProposedFix>> ProposeFixesAsync(IReadOnlyList<IssueForAnalysis> issues, CancellationToken ct);
}

public sealed record IssueForAnalysis(
    Guid IssueId, string Category, string Title, string Description, string? PageUrl,
    string? PageTitle, string? PageMetaDescription);

public sealed record ProposedFix(Guid IssueId, string ChangeType, string ProposedValueJson, string Rationale);
