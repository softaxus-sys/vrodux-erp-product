using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Dtos;
using Softaxis.Finance.Application.Banking.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class GetBankTransactionsHandler(FinanceDbContext db) : IQueryHandler<GetBankTransactionsQuery, IReadOnlyList<BankTransactionDto>>
{
    public async Task<Result<IReadOnlyList<BankTransactionDto>>> Handle(GetBankTransactionsQuery query, CancellationToken ct)
    {
        IQueryable<BankTransaction> q = db.BankTransactions.AsNoTracking();

        if (query.AccountId.HasValue) q = q.Where(x => x.AccountId == query.AccountId.Value);
        if (!string.IsNullOrWhiteSpace(query.Type)) q = q.Where(x => x.Type == query.Type);

        var items = await q.OrderByDescending(x => x.Date).ToListAsync(ct);

        return Result.Success<IReadOnlyList<BankTransactionDto>>(items.Select(BankingMappings.ToDto).ToList());
    }
}
