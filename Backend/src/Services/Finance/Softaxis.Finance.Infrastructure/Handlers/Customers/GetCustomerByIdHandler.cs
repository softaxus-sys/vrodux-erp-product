using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Customers.Dtos;
using Softaxis.Finance.Application.Customers.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Customers;

internal sealed class GetCustomerByIdHandler(FinanceDbContext db)
    : IQueryHandler<GetCustomerByIdQuery, CustomerDto>
{
    public async Task<Result<CustomerDto>> Handle(GetCustomerByIdQuery q, CancellationToken ct)
    {
        var customer = await db.Customers
            .AsNoTracking()
            .Where(x => x.Id == q.Id)
            .Select(x => new
            {
                x.Id, x.Code, x.Name, x.Email, x.Phone, x.Address, x.AccountId,
                x.CcEmails, x.IsActive, x.CreatedAt, x.UpdatedAt
            })
            .FirstOrDefaultAsync(ct);

        if (customer is null)
            return Result.Failure<CustomerDto>(Error.NotFoundById(nameof(Customer), q.Id));

        var account = customer.AccountId.HasValue
            ? await db.Accounts.AsNoTracking()
                .Where(x => x.Id == customer.AccountId.Value)
                .Select(x => new { x.AccountNumber, x.Name })
                .FirstOrDefaultAsync(ct)
            : null;

        return Result.Success(new CustomerDto(
            customer.Id, customer.Code, customer.Name, customer.Email, customer.Phone, customer.Address,
            customer.AccountId, account?.AccountNumber, account?.Name,
            customer.CcEmails, customer.IsActive, customer.CreatedAt, customer.UpdatedAt));
    }
}
