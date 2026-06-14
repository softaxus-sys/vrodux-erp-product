using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Projects.Commands;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Projects;

internal sealed class DeleteProjectHandler(ConstructionDbContext db)
    : ICommandHandler<DeleteProjectCommand>
{
    public async Task<Result> Handle(DeleteProjectCommand cmd, CancellationToken ct)
    {
        var p = await db.Projects.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Project", cmd.Id));

        p.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
