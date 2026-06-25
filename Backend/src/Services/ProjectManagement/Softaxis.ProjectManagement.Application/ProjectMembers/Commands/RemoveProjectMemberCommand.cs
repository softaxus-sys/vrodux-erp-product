using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.ProjectManagement.Application.ProjectMembers.Commands;

/// <summary>Removes a member from a project's team.</summary>
public sealed record RemoveProjectMemberCommand(Guid ProjectId, Guid MemberId) : ICommand;
