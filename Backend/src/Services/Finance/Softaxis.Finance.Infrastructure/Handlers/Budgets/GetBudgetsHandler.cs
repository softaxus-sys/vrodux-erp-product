using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Application.Budgets.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class GetBudgetsHandler(FinanceDbContext db) : IQueryHandler<GetBudgetsQuery, PagedResult<BudgetListItemDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for every budget ever set.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<BudgetListItemDto>>> Handle(GetBudgetsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is applied by hand.
        IQueryable<Budget> q = db.Budgets.AsNoTracking().Where(x => !x.IsDeleted).Include(x => x.Lines);

        if (!string.IsNullOrWhiteSpace(query.Period))
            q = q.Where(x => x.Period == query.Period);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Name.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.Period)
            .ThenByDescending(x => x.CreatedAt)   // stable: a period holds many budgets
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new BudgetListItemDto(
                x.Id, x.Name, x.Period, x.Status,
                x.Lines.Sum(l => l.BudgetedAmount),
                x.Lines.Sum(l => l.ActualAmount),
                x.Lines.Sum(l => l.BudgetedAmount) - x.Lines.Sum(l => l.ActualAmount),
                x.Lines.Count,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(PagedResult<BudgetListItemDto>.Create(items, total, page, pageSize));
    }
}
