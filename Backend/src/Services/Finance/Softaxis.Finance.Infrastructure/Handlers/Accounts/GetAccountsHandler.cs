using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Accounts.Dtos;
using Softaxis.Finance.Application.Accounts.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

internal sealed class GetAccountsHandler(FinanceDbContext db)
    : IQueryHandler<GetAccountsQuery, IReadOnlyList<AccountDto>>
{
    public async Task<Result<IReadOnlyList<AccountDto>>> Handle(
        GetAccountsQuery q, CancellationToken ct)
    {
        var query = db.Accounts.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q.Search))
            query = query.Where(x =>
                x.Name.Contains(q.Search) ||
                x.AccountNumber.Contains(q.Search));

        if (!string.IsNullOrWhiteSpace(q.AccountType))
            query = query.Where(x => x.AccountType == q.AccountType.ToLowerInvariant());

        if (q.IsActive.HasValue)
            query = query.Where(x => x.IsActive == q.IsActive.Value);

        var accounts = await query.OrderBy(x => x.AccountNumber).ToListAsync(ct);

        // Balance is the CURRENT balance (opening + posted movements), matching the trial balance
        // and balance sheet. Returning the raw opening balance made every account read 0.00.
        var movements      = await AccountBalances.LoadMovementsAsync(db, ct);
        var normalBalances = await AccountBalances.LoadNormalBalancesAsync(db, ct);

        var items = accounts
            .Select(x => new AccountDto(
                x.Id, x.AccountNumber, x.Name, x.AccountType,
                x.Description, x.ParentId, x.IsActive,
                AccountBalances.Current(x, movements, normalBalances),
                x.CreatedAt, x.UpdatedAt, x.AccountTypeId))
            .ToList();

        return Result.Success<IReadOnlyList<AccountDto>>(items);
    }
}
