using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

/// <summary>
/// Marks an approved expense paid and posts its ledger entry (debit the expense account, credit
/// cash or bank). Shared by the manual "mark as paid" action and auto-post recurring templates so
/// the two cannot post differently.
/// </summary>
internal static class ExpensePosting
{
    /// <summary>Does NOT save — the caller decides when.</summary>
    /// <returns>false, with nothing changed, when the expense date falls in a closed fiscal period.</returns>
    public static async Task<bool> PayAndPostAsync(FinanceDbContext db, Expense expense, CancellationToken ct)
    {
        if (await GlPoster.IsPeriodClosedAsync(db, expense.ExpenseDate, ct))
            return false;

        // Accounts chosen on the expense win; otherwise they are derived from category and method.
        var expenseAccount = await AccountNumberAsync(db, expense.ExpenseAccountId, ct)
                             ?? GlPoster.ResolveExpenseAccount(expense.Category);
        var cashAccount    = await AccountNumberAsync(db, expense.PaymentAccountId, ct)
                             ?? GlPoster.ResolveCashAccount(expense.PaymentMethod);
        var rate = await GlPoster.GetRateAsync(db, expense.CurrencyCode, expense.ExpenseDate, ct);
        var ledgerAmount = Math.Round(expense.Amount * rate, 2);
        var lines = new List<GlPoster.Line>
        {
            new(expenseAccount, ledgerAmount, 0, $"Expense {expense.ExpenseNumber} - {expense.Title}"),
            new(cashAccount, 0, ledgerAmount, $"Payment - Expense {expense.ExpenseNumber}"),
        };

        var journalEntryId = await GlPoster.PostAsync(db, expense.ExpenseDate, $"Expense {expense.ExpenseNumber} - {expense.Title}", expense.ExpenseNumber, lines, ct);

        // Marked paid only once the entry is built: posting throws when the ledger cannot take it,
        // and an expense showing "paid" with no journal entry behind it is worse than one not paid.
        expense.MarkPaid();
        expense.SetJournalEntryId(journalEntryId);

        return true;
    }

    /// <summary>The account's number, or null when none was chosen or it has since been deleted —
    /// in which case the caller falls back to the default rather than failing the posting.</summary>
    private static async Task<string?> AccountNumberAsync(FinanceDbContext db, Guid? accountId, CancellationToken ct)
    {
        if (accountId is null) return null;

        return await db.Accounts.AsNoTracking()
            .Where(a => a.Id == accountId && !a.IsDeleted)
            .Select(a => a.AccountNumber)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Checks accounts picked on a form before they are stored. Returns a message naming the
    /// problem, or null when both are usable.
    /// </summary>
    public static async Task<string?> ValidateAccountsAsync(
        FinanceDbContext db, Guid? expenseAccountId, Guid? paymentAccountId, CancellationToken ct)
    {
        if (expenseAccountId is not null && paymentAccountId is not null && expenseAccountId == paymentAccountId)
            return "The debit and credit accounts must be different.";

        foreach (var (id, label) in new[] { (expenseAccountId, "debit"), (paymentAccountId, "credit") })
        {
            if (id is null) continue;
            var usable = await db.Accounts.AsNoTracking().AnyAsync(a => a.Id == id && !a.IsDeleted && a.IsActive, ct);
            if (!usable) return $"The selected {label} account no longer exists or is inactive.";
        }

        return null;
    }
}
