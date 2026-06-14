namespace Softaxis.CRM.Application.Dashboard.Dtos;

public sealed record LeadFunnelStageDto(string Stage, int Count);

public sealed record LeadsBySourceDto(string Source, int Count);

public sealed record PipelineStageDto(string Stage, int Count, decimal Value);

public sealed record CrmDashboardDto(
    IReadOnlyList<LeadFunnelStageDto> LeadFunnel,
    IReadOnlyList<LeadsBySourceDto> LeadsBySource,
    IReadOnlyList<PipelineStageDto> PipelineByStage,
    decimal OpenPipelineValue, decimal WonValue, int WonCount, int LostCount, double WinRate,
    int TotalLeads, int TotalDeals, int OpenTasks, int OverdueTasks);
