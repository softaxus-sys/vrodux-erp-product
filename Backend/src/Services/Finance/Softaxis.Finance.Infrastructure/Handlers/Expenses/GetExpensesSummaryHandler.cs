using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Application.Expenses.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class GetExpensesSummaryHandler(FinanceDbContext db) : IQueryHandler<GetExpensesSummaryQuery, ExpensesSummaryDto>
{
    public async Task<Result<ExpensesSummaryDto>> Handle(GetExpensesSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Expenses.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Amount })
            .ToListAsync(ct);

        return Result.Success(new ExpensesSummaryDto(
            all.Count,
            all.Count(x => x.Status == "draft"),
            all.Count(x => x.Status == "pending"),
            all.Count(x => x.Status == "approved"),
            all.Count(x => x.Status == "rejected"),
            all.Count(x => x.Status == "paid"),
            all.Sum(x => x.Amount),
            all.Where(x => x.Status == "paid").Sum(x => x.Amount),
            all.Count(x => x.Status == "pending")));
    }
}
