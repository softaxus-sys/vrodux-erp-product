using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class CompleteRenewalHandler(CrmDbContext db) : ICommandHandler<CompleteRenewalCommand>
{
    public async Task<Result> Handle(CompleteRenewalCommand cmd, CancellationToken ct)
    {
        var ren = await db.PolicyRenewals.FindAsync([cmd.Id], ct);
        if (ren is null)
            return Result.Failure(Error.NotFoundById("PolicyRenewal", cmd.Id));

        ren.SetStatus("renewed");

        var pol = await db.Policies.FindAsync([ren.PolicyId], ct);
        pol?.SetStatus("renewed");

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
