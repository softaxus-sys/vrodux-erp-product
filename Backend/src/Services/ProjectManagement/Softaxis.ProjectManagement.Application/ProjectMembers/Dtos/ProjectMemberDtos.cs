namespace Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;

public sealed record ProjectMemberDto(
    Guid Id,
    Guid ProjectId,
    Guid UserId,
    string UserName,
    string? UserEmail,
    string Role,
    DateTime CreatedAt);
