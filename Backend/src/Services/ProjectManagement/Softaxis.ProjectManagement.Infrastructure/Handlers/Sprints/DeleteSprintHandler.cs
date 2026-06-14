using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Sprints.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Sprints;

internal sealed class DeleteSprintHandler(ProjectManagementDbContext db)
    : ICommandHandler<DeleteSprintCommand>
{
    public async Task<Result> Handle(DeleteSprintCommand cmd, CancellationToken ct)
    {
        var entity = await db.Sprints.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(Sprint), cmd.Id));

        var hasIssues = await db.Issues.AnyAsync(x => x.SprintId == cmd.Id, ct);
        if (hasIssues)
            return Result.Failure(Error.Custom(
                "Sprint.HasIssues", "Cannot delete a sprint that still has issues. Move its issues to the backlog first."));

        db.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
