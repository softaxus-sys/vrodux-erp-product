using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class UpdateCrmCustomerHandler(CrmDbContext db) : ICommandHandler<UpdateCrmCustomerCommand>
{
    public async Task<Result> Handle(UpdateCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        c.Update(cmd.Name, cmd.Industry, cmd.Country, cmd.City, cmd.Address, cmd.Phone, cmd.Email,
            cmd.Status, cmd.Tier, cmd.AccountManager, cmd.Description,
            cmd.Website, cmd.TradeName, cmd.Employees, cmd.NpsScore, cmd.ContractRenewal, cmd.Tags);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
