using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class UpdatePolicyStatusHandler(CrmDbContext db) : ICommandHandler<UpdatePolicyStatusCommand>
{
    public async Task<Result> Handle(UpdatePolicyStatusCommand cmd, CancellationToken ct)
    {
        var p = await db.Policies.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Policy", cmd.Id));

        p.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
