using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class DeleteContractHandler(CrmDbContext db) : ICommandHandler<DeleteContractCommand>
{
    public async Task<Result> Handle(DeleteContractCommand cmd, CancellationToken ct)
    {
        var c = await db.ServiceContracts.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("ServiceContract", cmd.Id));

        c.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
