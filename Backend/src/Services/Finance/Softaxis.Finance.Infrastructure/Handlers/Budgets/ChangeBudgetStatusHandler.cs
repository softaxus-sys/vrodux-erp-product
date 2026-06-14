using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class ChangeBudgetStatusHandler(FinanceDbContext db) : ICommandHandler<ChangeBudgetStatusCommand>
{
    public async Task<Result> Handle(ChangeBudgetStatusCommand cmd, CancellationToken ct)
    {
        var budget = await db.Budgets.FindAsync([cmd.Id], ct);

        if (budget is null)
            return Result.Failure(Error.NotFoundById("Budget", cmd.Id));

        if (budget.Status == cmd.Status)
            return Result.Success();

        if (!budget.CanTransitionTo(cmd.Status))
            return Result.Failure(Error.Custom("Budget.InvalidTransition",
                $"A {budget.Status} budget cannot be changed to {cmd.Status}."));

        budget.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
