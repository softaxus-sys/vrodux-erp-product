using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class CreateExpenseHandler(FinanceDbContext db) : ICommandHandler<CreateExpenseCommand, ExpenseDto>
{
    public async Task<Result<ExpenseDto>> Handle(CreateExpenseCommand cmd, CancellationToken ct)
    {
        var expense = new Expense(cmd.Title, cmd.Category, cmd.Amount, cmd.ExpenseDate,
            cmd.PaidBy, cmd.PaymentMethod, cmd.Reference, cmd.Notes);

        db.Expenses.Add(expense);
        await db.SaveChangesAsync(ct);

        return Result.Success(ExpenseMappings.ToDto(expense));
    }
}
