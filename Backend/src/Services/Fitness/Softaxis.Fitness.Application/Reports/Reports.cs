using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Fitness.Application.Reports;

/// <summary>Same shape as the other modules' tabular reports, so the Reports hub can run them.</summary>
public sealed record FitnessReportResult(IReadOnlyList<Dictionary<string, object?>> Rows, int TotalCount);

public sealed record RunFitnessReportQuery(string ReportId, string? From, string? To, Guid? BranchId, string? Today)
    : IQuery<FitnessReportResult>;
