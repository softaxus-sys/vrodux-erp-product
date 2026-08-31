namespace Softaxis.CRM.Application.Dashboard.Dtos;

public sealed record LeadFunnelStageDto(string Stage, int Count);

public sealed record LeadsBySourceDto(string Source, int Count);

public sealed record PipelineStageDto(string Stage, int Count, decimal Value);

/// <summary>New and converted leads per month of the current year, counted in SQL. The dashboard
/// used to download every lead — 6,019 of them on one tenant — purely to count these two things.</summary>
public sealed record LeadsByMonthDto(int Month, int NewLeads, int Converted);

public sealed record CrmDashboardDto(
    IReadOnlyList<LeadFunnelStageDto> LeadFunnel,
    IReadOnlyList<LeadsBySourceDto> LeadsBySource,
    IReadOnlyList<PipelineStageDto> PipelineByStage,
    IReadOnlyList<LeadsByMonthDto> LeadsByMonth,
    decimal OpenPipelineValue, decimal WonValue, int WonCount, int LostCount, double WinRate,
    int TotalLeads, int TotalDeals, int OpenTasks, int OverdueTasks);
