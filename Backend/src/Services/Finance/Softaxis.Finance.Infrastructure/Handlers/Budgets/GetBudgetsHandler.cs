using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Application.Budgets.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class GetBudgetsHandler(FinanceDbContext db) : IQueryHandler<GetBudgetsQuery, IReadOnlyList<BudgetListItemDto>>
{
    public async Task<Result<IReadOnlyList<BudgetListItemDto>>> Handle(GetBudgetsQuery query, CancellationToken ct)
    {
        IQueryable<Budget> q = db.Budgets.AsNoTracking().Where(x => !x.IsDeleted).Include(x => x.Lines);

        if (!string.IsNullOrWhiteSpace(query.Period))
            q = q.Where(x => x.Period == query.Period);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var items = await q
            .OrderByDescending(x => x.Period)
            .Select(x => new BudgetListItemDto(
                x.Id, x.Name, x.Period, x.Status,
                x.Lines.Sum(l => l.BudgetedAmount),
                x.Lines.Sum(l => l.ActualAmount),
                x.Lines.Sum(l => l.BudgetedAmount) - x.Lines.Sum(l => l.ActualAmount),
                x.Lines.Count,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<BudgetListItemDto>>(items);
    }
}
