namespace Softaxis.ProjectManagement.Application.Issues.Dtos;

public sealed record IssueLabelDto(Guid Id, string Name, string Color);

public sealed record IssueSummaryDto(
    Guid Id, Guid ProjectId, string IssueKey, string Title, string Type, string Priority,
    Guid BoardColumnId, string BoardColumnName, string BoardColumnCategory,
    Guid? AssigneeId, string? AssigneeName, string ReporterName,
    Guid? EpicId, string? EpicKey, string? EpicTitle, Guid? SprintId,
    decimal? StoryPoints, string? DueDate, int SortOrder, DateTime? ResolvedAt,
    IReadOnlyList<IssueLabelDto> Labels);

public sealed record IssueDto(
    Guid Id, Guid ProjectId, string IssueKey, string Title, string? Description, string Type, string Priority,
    Guid BoardColumnId, string BoardColumnName, string BoardColumnCategory,
    Guid? AssigneeId, string? AssigneeName, string ReporterName,
    Guid? EpicId, string? EpicKey, string? EpicTitle, Guid? SprintId, string? SprintName,
    decimal? StoryPoints, string? DueDate, int SortOrder, DateTime? ResolvedAt,
    DateTime CreatedAt, DateTime? UpdatedAt, IReadOnlyList<IssueLabelDto> Labels, int CommentCount);
