using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.ProjectMembers.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.ProjectMembers;

internal sealed class RemoveProjectMemberHandler(ProjectManagementDbContext db)
    : ICommandHandler<RemoveProjectMemberCommand>
{
    public async Task<Result> Handle(RemoveProjectMemberCommand cmd, CancellationToken ct)
    {
        var member = await db.ProjectMembers
            .FirstOrDefaultAsync(m => m.Id == cmd.MemberId && m.ProjectId == cmd.ProjectId, ct);
        if (member is null)
            return Result.Failure(Error.NotFoundById(nameof(ProjectMember), cmd.MemberId));

        if (member.Role == "owner")
        {
            var otherOwners = await db.ProjectMembers
                .CountAsync(m => m.ProjectId == cmd.ProjectId && m.Role == "owner" && m.Id != cmd.MemberId, ct);
            if (otherOwners == 0)
                return Result.Failure(Error.Custom("ProjectMember.Conflict", "Cannot remove the only owner of a project."));
        }

        db.ProjectMembers.Remove(member);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
