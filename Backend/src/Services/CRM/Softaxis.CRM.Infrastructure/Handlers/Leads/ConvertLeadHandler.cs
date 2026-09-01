using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class ConvertLeadHandler(CrmDbContext db, ILeadAccessGuard access, ILeadStatusRecorder statusRecorder) : ICommandHandler<ConvertLeadCommand, ConvertLeadResultDto>
{
    public async Task<Result<ConvertLeadResultDto>> Handle(ConvertLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null || !await access.CanEditAsync(l, ct))
            return Result.Failure<ConvertLeadResultDto>(Error.NotFoundById("Lead", cmd.Id));

        if (l.Status == "converted")
            return Result.Failure<ConvertLeadResultDto>(Error.Custom("Lead.AlreadyConverted", "Lead is already converted."));

        var customer = new CrmCustomer(l.Company, l.Industry, l.Country, l.City, "",
            l.Phone, l.Email, "standard", l.AssignedTo, l.Notes ?? "",
            accountManagerUserId: l.AssignedToUserId);
        db.Customers.Add(customer);

        // Carry the lead's person across as the account's primary contact (SFDC-style
        // Lead → Account + Contact + Opportunity conversion). Only when there's a name.
        Contact? contact = null;
        if (!string.IsNullOrWhiteSpace(l.FirstName) || !string.IsNullOrWhiteSpace(l.LastName))
        {
            contact = new Contact(customer.Id, l.FirstName, l.LastName, l.Title,
                l.Email, l.Phone, department: null, isPrimary: true, notes: null);
            db.Contacts.Add(contact);
        }

        // Include the lead's person name in the auto title so the opportunity is findable
        // by either the company or the person (pipeline search matches title + company).
        var autoTitle = string.IsNullOrWhiteSpace(l.FullName?.Trim())
            ? $"{l.Company} — New Opportunity"
            : $"{l.Company} — {l.FullName}".Trim(' ', '—');
        var deal = new Deal(
            string.IsNullOrWhiteSpace(cmd.DealTitle) ? autoTitle : cmd.DealTitle!,
            l.Company, cmd.DealValue ?? l.EstimatedValue, "qualified", l.Priority,
            20, cmd.ExpectedCloseDate ?? DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"),
            l.AssignedTo, l.Source, l.Industry, l.Notes ?? "", forecastCategory: null, customerId: customer.Id,
            // Carry the lead's owner onto the opportunity and the account. Without this the deal is
            // unowned, and a rep on the team or assigned tier converts a lead into something they
            // can no longer see.
            assignedToUserId: l.AssignedToUserId);
        // Carry the lead's TEAM onto both records too, not just the owner. Without this, converting
        // a lead that was filed to a specific team produces an untagged account and opportunity —
        // which fall back to the owner-membership rule and become visible to every team lead the
        // owner reports to, quietly undoing the conversion's team context.
        if (l.AssignedToUserId is not null && l.TeamId is not null)
        {
            customer.AssignAccountManager(l.AssignedToUserId, l.AssignedTo, l.TeamId);
            deal.AssignTo(l.AssignedToUserId, l.AssignedTo, l.TeamId);
        }

        db.Deals.Add(deal);

        // Attach the primary contact to the opportunity as the decision maker.
        if (contact is not null)
            db.DealContacts.Add(new DealContact(deal.Id, contact.Id, "decision_maker"));

        var previousStatus = l.Status;
        l.Convert(deal.Id.ToString(), customer.Id);
        await statusRecorder.RecordChangeAsync(l, previousStatus, ct);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ConvertLeadResultDto(customer.Id, deal.Id));
    }
}
