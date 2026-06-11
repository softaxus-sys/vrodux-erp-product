using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Application.Budgets.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class GetBudgetsSummaryHandler(FinanceDbContext db) : IQueryHandler<GetBudgetsSummaryQuery, BudgetsSummaryDto>
{
    public async Task<Result<BudgetsSummaryDto>> Handle(GetBudgetsSummaryQuery query, CancellationToken ct)
    {
        var budgets = await db.Budgets.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Include(x => x.Lines)
            .ToListAsync(ct);

        if (budgets.Count == 0)
            return Result.Success(new BudgetsSummaryDto(0m, 0m, 0m, 0m, 0, 0, 0m));

        var totalBudget = budgets.Sum(b => b.TotalBudgeted);
        var totalActual = budgets.Sum(b => b.TotalActual);
        var variance    = totalBudget - totalActual;
        var variancePct = totalBudget > 0 ? variance / totalBudget * 100 : 0;
        var utilisation = totalBudget > 0 ? totalActual / totalBudget * 100 : 0;

        return Result.Success(new BudgetsSummaryDto(
            totalBudget,
            totalActual,
            variance,
            Math.Round(variancePct, 1),
            budgets.Count(b => b.TotalActual > b.TotalBudgeted),
            budgets.Count(b => b.TotalActual <= b.TotalBudgeted),
            Math.Round(utilisation, 1)));
    }
}
