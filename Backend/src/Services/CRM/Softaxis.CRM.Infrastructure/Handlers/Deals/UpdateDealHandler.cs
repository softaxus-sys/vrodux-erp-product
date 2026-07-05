using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class UpdateDealHandler(CrmDbContext db) : ICommandHandler<UpdateDealCommand>
{
    public async Task<Result> Handle(UpdateDealCommand cmd, CancellationToken ct)
    {
        var d = await db.Deals.FindAsync([cmd.Id], ct);
        if (d is null)
            return Result.Failure(Error.NotFoundById("Deal", cmd.Id));

        // When linked to an account, use its canonical name as the denormalized display company.
        var company = cmd.Company;
        if (cmd.CustomerId is Guid cid)
        {
            var acct = await db.Customers.FindAsync([cid], ct);
            if (acct is not null) company = acct.Name;
        }

        d.Update(cmd.Title, company, cmd.Value, cmd.Stage, cmd.Priority, cmd.Probability,
            cmd.ExpectedCloseDate, cmd.AssignedTo, cmd.Source, cmd.Industry, cmd.Description,
            cmd.NextAction, cmd.NextActionDate, cmd.Tags, cmd.ForecastCategory, cmd.CustomerId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
