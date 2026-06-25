using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.ProjectMembers.Commands;
using Softaxis.ProjectManagement.Application.ProjectMembers.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.ProjectMembers;

internal sealed class AddProjectMemberHandler(ProjectManagementDbContext db)
    : ICommandHandler<AddProjectMemberCommand, ProjectMemberDto>
{
    public async Task<Result<ProjectMemberDto>> Handle(AddProjectMemberCommand cmd, CancellationToken ct)
    {
        var projectExists = await db.Projects.AnyAsync(p => p.Id == cmd.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<ProjectMemberDto>(Error.NotFoundById(nameof(Project), cmd.ProjectId));

        var alreadyMember = await db.ProjectMembers
            .AnyAsync(m => m.ProjectId == cmd.ProjectId && m.UserId == cmd.UserId, ct);
        if (alreadyMember)
            return Result.Failure<ProjectMemberDto>(Error.Custom("ProjectMember.Duplicate", "User is already a member of this project."));

        var member = new ProjectMember(cmd.ProjectId, cmd.UserId, cmd.UserName, cmd.UserEmail, cmd.Role);
        db.ProjectMembers.Add(member);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectMemberDto(member.Id, member.ProjectId, member.UserId, member.UserName, member.UserEmail, member.Role, member.CreatedAt));
    }
}
