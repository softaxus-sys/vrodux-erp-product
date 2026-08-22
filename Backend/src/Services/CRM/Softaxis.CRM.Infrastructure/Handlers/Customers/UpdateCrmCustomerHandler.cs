using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class UpdateCrmCustomerHandler(CrmDbContext db, ILeadAccessGuard access) : ICommandHandler<UpdateCrmCustomerCommand>
{
    public async Task<Result> Handle(UpdateCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        // Restricted tiers may only act on accounts they own (or their team owns).
        if (!await access.CanEditCustomerAsync(c, ct))
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        c.Update(cmd.Name, cmd.Industry, cmd.Country, cmd.City, cmd.Address, cmd.Phone, cmd.Email,
            cmd.Status, cmd.Tier, cmd.AccountManager, cmd.Description,
            cmd.Website, cmd.TradeName, cmd.Employees, cmd.NpsScore, cmd.ContractRenewal, cmd.Tags, cmd.AccountManagerUserId);

        // Update() does not carry the team — re-stamp manager + team together.
        c.AssignAccountManager(cmd.AccountManagerUserId, cmd.AccountManager, cmd.TeamId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
