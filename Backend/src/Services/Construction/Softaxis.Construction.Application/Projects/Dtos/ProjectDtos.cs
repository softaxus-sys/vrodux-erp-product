namespace Softaxis.Construction.Application.Projects.Dtos;

public sealed record ProjectPhaseDto(
    Guid Id, string Name, string StartDate, string EndDate, string Status, int CompletionPct);

public sealed record ProjectDto(
    Guid Id, string ProjectNumber, string Name, string Client, string Location, string ProjectType,
    string Status, string StartDate, string EndDate, decimal ContractValue, decimal BudgetSpent,
    decimal BudgetRemaining, int CompletionPct, string ProjectManager, string SiteEngineer,
    int Workers, string? Notes, IReadOnlyList<ProjectPhaseDto> Phases);

public sealed record ProjectsSummaryDto(
    int Total, int InProgress, int Completed, int OnHold, int Planning,
    decimal TotalContractValue, decimal TotalSpent, double AvgCompletion);
