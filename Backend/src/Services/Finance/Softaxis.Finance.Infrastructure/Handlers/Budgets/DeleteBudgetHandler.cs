using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Budgets.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal sealed class DeleteBudgetHandler(FinanceDbContext db) : ICommandHandler<DeleteBudgetCommand>
{
    public async Task<Result> Handle(DeleteBudgetCommand cmd, CancellationToken ct)
    {
        var budget = await db.Budgets.FindAsync([cmd.Id], ct);

        if (budget is null)
            return Result.Failure(Error.NotFoundById("Budget", cmd.Id));

        budget.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
