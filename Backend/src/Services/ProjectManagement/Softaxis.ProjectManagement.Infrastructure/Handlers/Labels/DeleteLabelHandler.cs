using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Labels.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Labels;

internal sealed class DeleteLabelHandler(ProjectManagementDbContext db)
    : ICommandHandler<DeleteLabelCommand>
{
    public async Task<Result> Handle(DeleteLabelCommand cmd, CancellationToken ct)
    {
        var entity = await db.Labels.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(Label), cmd.Id));

        db.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
