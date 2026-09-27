namespace Softaxis.Seo.Infrastructure.Ai;

public interface ISeoAiAnalyzer
{
    Task<AiAnalysisResult> ProposeFixesAsync(IReadOnlyList<IssueForAnalysis> issues, CancellationToken ct);
}

public sealed record IssueForAnalysis(
    Guid IssueId, string Category, string Title, string Description, string? PageUrl,
    string? PageTitle, string? PageMetaDescription);

public sealed record ProposedFix(Guid IssueId, string ChangeType, string ProposedValueJson, string Rationale);

/// <summary>
/// <see cref="SkippedReason"/> is set ONLY when the AI call itself never ran/succeeded (not
/// configured, provider error, etc.) — never when the AI ran fine and genuinely proposed nothing.
/// That distinction is the whole point: without it, "AI isn't set up for this tenant" and "AI looked
/// at every issue and found nothing worth fixing" both show up identically as "0 fixes proposed",
/// which is exactly the confusing state this module shipped in.
/// </summary>
public sealed record AiAnalysisResult(IReadOnlyList<ProposedFix> Fixes, string? SkippedReason);
