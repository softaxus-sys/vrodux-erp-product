namespace Softaxis.ProjectManagement.Application.BoardColumns.Dtos;

public sealed record BoardColumnDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string Category,
    int SortOrder,
    bool IsDefault);
