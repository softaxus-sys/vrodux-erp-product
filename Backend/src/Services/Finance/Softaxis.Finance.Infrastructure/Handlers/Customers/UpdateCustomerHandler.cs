using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Customers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Customers;

internal sealed class UpdateCustomerHandler(FinanceDbContext db)
    : ICommandHandler<UpdateCustomerCommand>
{
    public async Task<Result> Handle(UpdateCustomerCommand cmd, CancellationToken ct)
    {
        var customer = await db.Customers.FindAsync([cmd.Id], ct);
        if (customer is null)
            return Result.Failure(Error.NotFoundById(nameof(Customer), cmd.Id));

        if (cmd.AccountId.HasValue)
        {
            var accountExists = await db.Accounts.AnyAsync(x => x.Id == cmd.AccountId.Value, ct);
            if (!accountExists)
                return Result.Failure(
                    Error.Custom("Customer.AccountNotFound",
                        $"Account '{cmd.AccountId}' was not found."));
        }

        customer.Update(cmd.Name, cmd.Email, cmd.Phone, cmd.Address, cmd.AccountId, cmd.IsActive, cmd.CcEmails);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
