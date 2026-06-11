using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class DeletePolicyHandler(CrmDbContext db) : ICommandHandler<DeletePolicyCommand>
{
    public async Task<Result> Handle(DeletePolicyCommand cmd, CancellationToken ct)
    {
        var p = await db.Policies.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Policy", cmd.Id));

        p.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
