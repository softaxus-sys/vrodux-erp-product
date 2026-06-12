using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class MarkExpensePaidHandler(FinanceDbContext db) : ICommandHandler<MarkExpensePaidCommand>
{
    public async Task<Result> Handle(MarkExpensePaidCommand cmd, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([cmd.Id], ct);

        if (expense is null)
            return Result.Failure(Error.NotFoundById("Expense", cmd.Id));

        if (expense.Status != "approved")
            return Result.Failure(Error.Custom("Expense.Conflict", "Only approved expenses can be marked as paid."));

        expense.MarkPaid();

        var expenseAccount = GlPoster.ResolveExpenseAccount(expense.Category);
        var cashAccount    = GlPoster.ResolveCashAccount(expense.PaymentMethod);
        var rate = await GlPoster.GetRateAsync(db, expense.CurrencyCode, expense.ExpenseDate, ct);
        var amountAed = expense.Amount * rate;
        var lines = new List<GlPoster.Line>
        {
            new(expenseAccount, amountAed, 0, $"Expense {expense.ExpenseNumber} - {expense.Title}"),
            new(cashAccount, 0, amountAed, $"Payment - Expense {expense.ExpenseNumber}"),
        };

        var journalEntryId = await GlPoster.PostAsync(db, expense.ExpenseDate, $"Expense {expense.ExpenseNumber} - {expense.Title}", expense.ExpenseNumber, lines, ct);
        expense.SetJournalEntryId(journalEntryId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
