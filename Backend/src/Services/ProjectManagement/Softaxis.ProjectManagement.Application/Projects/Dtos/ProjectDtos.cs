namespace Softaxis.ProjectManagement.Application.Projects.Dtos;

public sealed record ProjectDto(
    Guid Id,
    string Key,
    string Name,
    string? Description,
    string Status,
    string? LeadName,
    int NextIssueNumber,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProjectSummaryDto(
    Guid Id,
    string Key,
    string Name,
    string? Description,
    string Status,
    string? LeadName,
    int TotalIssues,
    int TodoCount,
    int InProgressCount,
    int DoneCount,
    DateTime CreatedAt);
