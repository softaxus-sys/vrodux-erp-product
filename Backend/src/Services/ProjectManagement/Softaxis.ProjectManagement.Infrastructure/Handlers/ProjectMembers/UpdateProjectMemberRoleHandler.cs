using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.ProjectMembers.Commands;
using Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.ProjectMembers;

internal sealed class UpdateProjectMemberRoleHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateProjectMemberRoleCommand, ProjectMemberDto>
{
    public async Task<Result<ProjectMemberDto>> Handle(UpdateProjectMemberRoleCommand cmd, CancellationToken ct)
    {
        var member = await db.ProjectMembers
            .FirstOrDefaultAsync(m => m.Id == cmd.MemberId && m.ProjectId == cmd.ProjectId, ct);
        if (member is null)
            return Result.Failure<ProjectMemberDto>(Error.NotFoundById(nameof(ProjectMember), cmd.MemberId));

        if (member.Role == "owner" && cmd.Role != "owner")
        {
            var otherOwners = await db.ProjectMembers
                .CountAsync(m => m.ProjectId == cmd.ProjectId && m.Role == "owner" && m.Id != cmd.MemberId, ct);
            if (otherOwners == 0)
                return Result.Failure<ProjectMemberDto>(Error.Custom("ProjectMember.Conflict", "Cannot change the role of the only owner of a project."));
        }

        member.ChangeRole(cmd.Role);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectMemberDto(member.Id, member.ProjectId, member.UserId, member.UserName, member.UserEmail, member.Role, member.CreatedAt));
    }
}
