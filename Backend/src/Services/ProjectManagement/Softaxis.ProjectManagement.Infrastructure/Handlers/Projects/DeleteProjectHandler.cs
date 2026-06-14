using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Projects.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Projects;

internal sealed class DeleteProjectHandler(ProjectManagementDbContext db)
    : ICommandHandler<DeleteProjectCommand>
{
    public async Task<Result> Handle(DeleteProjectCommand cmd, CancellationToken ct)
    {
        var entity = await db.Projects.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(Project), cmd.Id));

        var hasIssues = await db.Issues.AnyAsync(x => x.ProjectId == cmd.Id, ct);
        if (hasIssues)
            return Result.Failure(Error.Custom(
                "Project.HasIssues", "Cannot delete a project that still has issues. Delete its issues first."));

        db.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
