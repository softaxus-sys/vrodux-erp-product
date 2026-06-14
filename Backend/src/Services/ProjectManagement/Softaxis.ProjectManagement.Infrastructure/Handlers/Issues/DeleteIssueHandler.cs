using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class DeleteIssueHandler(ProjectManagementDbContext db)
    : ICommandHandler<DeleteIssueCommand>
{
    public async Task<Result> Handle(DeleteIssueCommand cmd, CancellationToken ct)
    {
        var entity = await db.Issues.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(Issue), cmd.Id));

        db.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
