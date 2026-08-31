using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Dtos;
using Softaxis.Finance.Application.Banking.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class GetBankTransactionsHandler(FinanceDbContext db) : IQueryHandler<GetBankTransactionsQuery, PagedResult<BankTransactionDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole statement history back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<BankTransactionDto>>> Handle(GetBankTransactionsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        IQueryable<BankTransaction> q = db.BankTransactions.AsNoTracking();

        if (query.AccountId.HasValue) q = q.Where(x => x.AccountId == query.AccountId.Value);
        if (!string.IsNullOrWhiteSpace(query.Type)) q = q.Where(x => x.Type == query.Type);
        if (query.Reconciled.HasValue) q = q.Where(x => x.Reconciled == query.Reconciled.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Description.Contains(query.Search) || x.Reference.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.CreatedAt)   // stable: a statement day holds many lines
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<BankTransactionDto>.Create(
            items.Select(BankingMappings.ToDto).ToList(), total, page, pageSize));
    }
}
