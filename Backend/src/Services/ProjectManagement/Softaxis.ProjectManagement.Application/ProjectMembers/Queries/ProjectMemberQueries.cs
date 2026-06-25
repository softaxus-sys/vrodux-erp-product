using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;

namespace Softaxis.ProjectManagement.Application.ProjectMembers.Queries;

/// <summary>Returns all members of the given project.</summary>
public sealed record GetProjectMembersQuery(Guid ProjectId) : IQuery<IReadOnlyList<ProjectMemberDto>>;
