using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class UpdateRenewalStatusHandler(CrmDbContext db) : ICommandHandler<UpdateRenewalStatusCommand>
{
    public async Task<Result> Handle(UpdateRenewalStatusCommand cmd, CancellationToken ct)
    {
        var x = await db.PolicyRenewals.FindAsync([cmd.Id], ct);
        if (x is null)
            return Result.Failure(Error.NotFoundById("PolicyRenewal", cmd.Id));

        x.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
