using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class DeleteCrmCustomerHandler(CrmDbContext db, ILeadAccessGuard access) : ICommandHandler<DeleteCrmCustomerCommand>
{
    public async Task<Result> Handle(DeleteCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        // Restricted tiers may only act on accounts they own (or their team owns).
        if (!await access.CanEditCustomerAsync(c, ct))
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        c.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
