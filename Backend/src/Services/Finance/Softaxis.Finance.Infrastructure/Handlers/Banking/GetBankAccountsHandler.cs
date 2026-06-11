using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Dtos;
using Softaxis.Finance.Application.Banking.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class GetBankAccountsHandler(FinanceDbContext db) : IQueryHandler<GetBankAccountsQuery, IReadOnlyList<BankAccountDto>>
{
    public async Task<Result<IReadOnlyList<BankAccountDto>>> Handle(GetBankAccountsQuery query, CancellationToken ct)
    {
        var items = await db.BankAccounts.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .OrderBy(x => x.AccountName)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<BankAccountDto>>(items.Select(BankingMappings.ToDto).ToList());
    }
}
