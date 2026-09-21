using System.Text.Json;
using Softaxis.BuildingBlocks.Application.AiEvents;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Handlers.Notifications;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class CreateCrmCustomerHandler(
    CrmDbContext db, IAiEventBus aiEvents, ICurrentUser currentUser, ILeadAccessGuard access,
    ICrmAssignmentNotifier notifications)
    : ICommandHandler<CreateCrmCustomerCommand, CrmCustomerDto>
{
    public async Task<Result<CrmCustomerDto>> Handle(CreateCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = new CrmCustomer(cmd.Name, cmd.Industry, cmd.Country, cmd.City, cmd.Address,
            cmd.Phone, cmd.Email, cmd.Tier, cmd.AccountManager, cmd.Description, cmd.AccountManagerUserId, cmd.PaymentTerms);

        // Default the account manager to the CREATOR and the team to theirs when unambiguous — see
        // CreateLeadHandler. An explicit choice always wins.
        var managerId = cmd.AccountManagerUserId ?? currentUser.Id;
        var managerName = cmd.AccountManagerUserId is not null
            ? cmd.AccountManager
            : (string.IsNullOrWhiteSpace(cmd.AccountManager) ? currentUser.Username ?? "" : cmd.AccountManager);

        if (managerId is not null)
            c.AssignAccountManager(managerId, managerName, cmd.TeamId ?? await access.SoleTeamOfCurrentUserAsync(ct));

        db.Customers.Add(c);
        await db.SaveChangesAsync(ct);

        // Fire an AI event so event-triggered automations can react (best-effort, never throws).
        await aiEvents.PublishAsync(new AiTriggerEvent(
            AiEventKeys.CrmCustomerCreated, c.Id, $"New customer: {c.Name}",
            JsonSerializer.Serialize(new { c.Id, c.Name, c.Industry, c.Email, c.Phone })), ct);

        await notifications.NotifyAssignmentAsync(new CrmAssignment(
            managerId, managerName, null, c.TeamId, currentUser.Id, currentUser.Username,
            NotificationEvents.AccountAssigned, NotificationEvents.AccountAssignedToMember,
            "Account", c.Name, $"/crm/customers?customer={c.Id}", "customer", c.Id), ct: ct);

        return Result.Success(// A brand-new account has no deals yet, so its figures are zero by construction.
        CrmCustomerMappings.ToDto(c, CustomerDealMetrics.None));
    }
}
