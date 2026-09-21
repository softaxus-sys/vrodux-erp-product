using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Infrastructure.Handlers.Notifications;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class UpdateCrmCustomerHandler(
    CrmDbContext db, ILeadAccessGuard access, ICurrentUser currentUser, ICrmAssignmentNotifier notifications)
    : ICommandHandler<UpdateCrmCustomerCommand>
{
    public async Task<Result> Handle(UpdateCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        // Restricted tiers may only act on accounts they own (or their team owns).
        if (!await access.CanEditCustomerAsync(c, ct))
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        var previousManager = c.AccountManagerUserId;

        c.Update(cmd.Name, cmd.Industry, cmd.Country, cmd.City, cmd.Address, cmd.Phone, cmd.Email,
            cmd.Status, cmd.Tier, cmd.AccountManager, cmd.Description,
            cmd.Website, cmd.TradeName, cmd.Employees, cmd.NpsScore, cmd.ContractRenewal, cmd.Tags,
            cmd.AccountManagerUserId, cmd.PaymentTerms);

        // Update() does not carry the team — re-stamp manager + team together.
        c.AssignAccountManager(cmd.AccountManagerUserId, cmd.AccountManager, cmd.TeamId);

        await db.SaveChangesAsync(ct);

        await notifications.NotifyAssignmentAsync(new CrmAssignment(
            cmd.AccountManagerUserId, cmd.AccountManager, previousManager, c.TeamId,
            currentUser.Id, currentUser.Username,
            NotificationEvents.AccountAssigned, NotificationEvents.AccountAssignedToMember,
            "Account", c.Name, $"/crm/customers?customer={c.Id}", "customer", c.Id), ct: ct);

        return Result.Success();
    }
}
