using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Customers.Commands;
using Softaxis.Finance.Application.Customers.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Customers;

internal sealed class CreateCustomerHandler(FinanceDbContext db)
    : ICommandHandler<CreateCustomerCommand, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(CreateCustomerCommand cmd, CancellationToken ct)
    {
        if (cmd.AccountId.HasValue)
        {
            var accountExists = await db.Accounts.AnyAsync(x => x.Id == cmd.AccountId.Value, ct);
            if (!accountExists)
                return Result.Failure<CustomerDto>(
                    Error.Custom("Customer.AccountNotFound",
                        $"Account '{cmd.AccountId}' was not found."));
        }

        var customer = new Customer(cmd.Name, cmd.Email, cmd.Phone, cmd.Address, cmd.AccountId);
        if (!cmd.IsActive)
            customer.Update(cmd.Name, cmd.Email, cmd.Phone, cmd.Address, cmd.AccountId, false);

        db.Customers.Add(customer);
        await db.SaveChangesAsync(ct);

        Account? account = cmd.AccountId.HasValue
            ? await db.Accounts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.AccountId.Value, ct)
            : null;

        return Result.Success(new CustomerDto(
            customer.Id, customer.Code, customer.Name, customer.Email, customer.Phone, customer.Address,
            customer.AccountId, account?.AccountNumber, account?.Name,
            customer.IsActive, customer.CreatedAt, customer.UpdatedAt));
    }
}
