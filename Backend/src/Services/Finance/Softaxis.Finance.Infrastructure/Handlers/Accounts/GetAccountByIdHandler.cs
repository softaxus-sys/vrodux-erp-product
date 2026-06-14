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
            .Where(x => x.Id == q.Id)
            .Select(x => new AccountDto(
                x.Id, x.AccountNumber, x.Name, x.AccountType,
                x.Description, x.ParentId, x.IsActive, x.Balance,
                x.CreatedAt, x.UpdatedAt, x.AccountTypeId))
            .FirstOrDefaultAsync(ct);

        return acc is null
            ? Result.Failure<AccountDto>(Error.NotFoundById(nameof(Account), q.Id))
            : Result.Success(acc);
    }
}
