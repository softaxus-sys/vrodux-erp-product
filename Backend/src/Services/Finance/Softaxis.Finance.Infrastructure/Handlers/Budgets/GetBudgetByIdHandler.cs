using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Application.Budgets.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class GetBudgetByIdHandler(FinanceDbContext db) : IQueryHandler<GetBudgetByIdQuery, BudgetDto>
{
    public async Task<Result<BudgetDto>> Handle(GetBudgetByIdQuery query, CancellationToken ct)
    {
        var budget = await db.Budgets.AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (budget is null)
            return Result.Failure<BudgetDto>(Error.NotFoundById("Budget", query.Id));

        return Result.Success(BudgetMappings.ToDto(budget));
    }
}
