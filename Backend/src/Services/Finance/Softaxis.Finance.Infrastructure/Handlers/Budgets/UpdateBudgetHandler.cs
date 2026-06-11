using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class UpdateBudgetHandler(FinanceDbContext db) : ICommandHandler<UpdateBudgetCommand>
{
    public async Task<Result> Handle(UpdateBudgetCommand cmd, CancellationToken ct)
    {
        var budget = await db.Budgets.Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (budget is null)
            return Result.Failure(Error.NotFoundById("Budget", cmd.Id));

        budget.Update(cmd.Name, cmd.Period, cmd.Status, cmd.Notes);

        db.BudgetLines.RemoveRange(budget.Lines);
        budget.Lines.Clear();
        foreach (var l in cmd.Lines)
            budget.Lines.Add(new BudgetLine(budget.Id, l.Category, l.AccountName, l.BudgetedAmount));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
