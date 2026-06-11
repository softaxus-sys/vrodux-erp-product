using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Commands;
using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class CreateBudgetHandler(FinanceDbContext db) : ICommandHandler<CreateBudgetCommand, BudgetDto>
{
    public async Task<Result<BudgetDto>> Handle(CreateBudgetCommand cmd, CancellationToken ct)
    {
        var budget = new Budget(cmd.Name, cmd.Period, cmd.Notes);

        foreach (var l in cmd.Lines)
            budget.Lines.Add(new BudgetLine(budget.Id, l.Category, l.AccountName, l.BudgetedAmount));

        db.Budgets.Add(budget);
        await db.SaveChangesAsync(ct);

        return Result.Success(BudgetMappings.ToDto(budget));
    }
}
