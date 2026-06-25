using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;
using Softaxis.ProjectManagement.Application.ProjectMembers.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.ProjectMembers;

internal sealed class GetProjectMembersHandler(ProjectManagementDbContext db)
    : IQueryHandler<GetProjectMembersQuery, IReadOnlyList<ProjectMemberDto>>
{
    public async Task<Result<IReadOnlyList<ProjectMemberDto>>> Handle(GetProjectMembersQuery query, CancellationToken ct)
    {
        var members = await db.ProjectMembers
            .AsNoTracking()
            .Where(m => m.ProjectId == query.ProjectId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new ProjectMemberDto(m.Id, m.ProjectId, m.UserId, m.UserName, m.UserEmail, m.Role, m.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ProjectMemberDto>>(members);
    }
}
