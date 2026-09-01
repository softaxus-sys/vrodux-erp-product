using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Customers.Dtos;
using Softaxis.Finance.Application.Customers.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Customers;

internal sealed class GetCustomersHandler(FinanceDbContext db)
    : IQueryHandler<GetCustomersQuery, IReadOnlyList<CustomerDto>>
{
    public async Task<Result<IReadOnlyList<CustomerDto>>> Handle(GetCustomersQuery q, CancellationToken ct)
    {
        var query = db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Search))
            query = query.Where(x =>
                x.Name.Contains(q.Search) ||
                x.Code.Contains(q.Search) ||
                (x.Email != null && x.Email.Contains(q.Search)));

        if (q.IsActive.HasValue)
            query = query.Where(x => x.IsActive == q.IsActive.Value);

        var rows = await query
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id, x.Code, x.Name, x.Email, x.Phone, x.Address, x.AccountId,
                x.CcEmails, x.IsActive, x.CreatedAt, x.UpdatedAt
            })
            .ToListAsync(ct);

        var accountIds = rows.Where(x => x.AccountId.HasValue).Select(x => x.AccountId!.Value).Distinct().ToList();
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => accountIds.Contains(x.Id))
            .Select(x => new { x.Id, x.AccountNumber, x.Name })
            .ToDictionaryAsync(x => x.Id, ct);

        var items = rows.Select(x =>
        {
            var account = x.AccountId.HasValue && accounts.TryGetValue(x.AccountId.Value, out var a) ? a : null;
            return new CustomerDto(
                x.Id, x.Code, x.Name, x.Email, x.Phone, x.Address,
                x.AccountId, account?.AccountNumber, account?.Name,
                x.CcEmails, x.IsActive, x.CreatedAt, x.UpdatedAt);
        }).ToList();

        return Result.Success<IReadOnlyList<CustomerDto>>(items);
    }
}
