using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class UpdateContractStatusHandler(CrmDbContext db) : ICommandHandler<UpdateContractStatusCommand>
{
    public async Task<Result> Handle(UpdateContractStatusCommand cmd, CancellationToken ct)
    {
        var c = await db.ServiceContracts.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("ServiceContract", cmd.Id));

        c.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
