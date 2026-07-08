using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class DeleteVisaCaseHandler(VisaDbContext db) : ICommandHandler<DeleteVisaCaseCommand>
{
    public async Task<Result> Handle(DeleteVisaCaseCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.Id], ct);
        if (vcase is null)
            return Result.Failure(Error.NotFoundById("VisaCase", cmd.Id));

        vcase.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
