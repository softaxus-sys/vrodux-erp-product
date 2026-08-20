using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class CreateDealHandler(CrmDbContext db) : ICommandHandler<CreateDealCommand, DealDto>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand cmd, CancellationToken ct)
    {
        // When linked to an account, use its canonical name as the denormalized display company.
        var company = cmd.Company;
        if (cmd.CustomerId is Guid cid)
        {
            var acct = await db.Customers.FindAsync([cid], ct);
            if (acct is not null) company = acct.Name;
        }

        var d = new Deal(cmd.Title, company, cmd.Value, cmd.Stage, cmd.Priority,
            cmd.Probability, cmd.ExpectedCloseDate, cmd.AssignedTo, cmd.Source, cmd.Industry, cmd.Description,
            cmd.ForecastCategory, cmd.CustomerId, cmd.AssignedToUserId);

        db.Deals.Add(d);
        await db.SaveChangesAsync(ct);

        return Result.Success(DealMappings.ToDto(d));
    }
}
