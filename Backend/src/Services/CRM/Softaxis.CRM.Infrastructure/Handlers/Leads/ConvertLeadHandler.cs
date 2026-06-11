using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class ConvertLeadHandler(CrmDbContext db) : ICommandHandler<ConvertLeadCommand, ConvertLeadResultDto>
{
    public async Task<Result<ConvertLeadResultDto>> Handle(ConvertLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null)
            return Result.Failure<ConvertLeadResultDto>(Error.NotFoundById("Lead", cmd.Id));

        if (l.Status == "converted")
            return Result.Failure<ConvertLeadResultDto>(Error.Custom("Lead.AlreadyConverted", "Lead is already converted."));

        var customer = new CrmCustomer(l.Company, l.Industry, l.Country, l.City, "",
            l.Phone, l.Email, "standard", l.AssignedTo, l.Notes ?? "");
        db.Customers.Add(customer);

        var deal = new Deal(
            string.IsNullOrWhiteSpace(cmd.DealTitle) ? $"{l.Company} — New Opportunity" : cmd.DealTitle!,
            l.Company, cmd.DealValue ?? l.EstimatedValue, "qualified", l.Priority,
            20, cmd.ExpectedCloseDate ?? DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"),
            l.AssignedTo, l.Source, l.Industry, l.Notes ?? "");
        db.Deals.Add(deal);

        l.Convert(deal.Id.ToString());
        await db.SaveChangesAsync(ct);

        return Result.Success(new ConvertLeadResultDto(customer.Id, deal.Id));
    }
}
