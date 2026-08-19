using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Accounts.Dtos;
using Softaxis.Finance.Application.Accounts.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

internal sealed class GetAccountByIdHandler(FinanceDbContext db)
    : IQueryHandler<GetAccountByIdQuery, AccountDto>
{
    public async Task<Result<AccountDto>> Handle(
        GetAccountByIdQuery q, CancellationToken ct)
    {
        var acc = await db.Accounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == q.Id, ct);

        if (acc is null)
            return Result.Failure<AccountDto>(Error.NotFoundById(nameof(Account), q.Id));

        // Current balance = opening + posted movements (see AccountBalances).
        var movements      = await AccountBalances.LoadMovementsAsync(db, ct);
        var normalBalances = await AccountBalances.LoadNormalBalancesAsync(db, ct);

        return Result.Success(new AccountDto(
            acc.Id, acc.AccountNumber, acc.Name, acc.AccountType,
            acc.Description, acc.ParentId, acc.IsActive,
            AccountBalances.Current(acc, movements, normalBalances),
            acc.CreatedAt, acc.UpdatedAt, acc.AccountTypeId));
    }
}
