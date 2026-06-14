namespace Softaxis.ProjectManagement.Application.Sprints.Dtos;

public sealed record SprintDto(
    Guid Id, Guid ProjectId, string Name, string? Goal, string? StartDate, string? EndDate,
    string Status, int SortOrder, int IssueCount);
