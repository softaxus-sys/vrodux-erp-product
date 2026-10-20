using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.Expenses;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>What generating one expense did. <c>Held</c> = an auto-post template that could not
/// post, so the expense was left for a person; <c>Message</c> says why.</summary>
public sealed record RecurringExpenseOutcome(Expense Expense, bool Posted, bool Held, string? Message);

public sealed record RecurringExpenseRunResult(int Created, int Posted, int Held);

/// <summary>
/// Materialises real expenses from recurring-expense templates. Used by the manual API triggers
/// and the daily background job.
///
/// <para><b>Tenancy.</b> Must only be called with an ambient tenant resolved — without one the
/// query filter is bypassed (every workspace's templates) and the generated expenses are stamped
/// <c>TenantId = NULL</c>, invisible to the workspace that owns the template. The currency comes
/// from the same ambient context, through <c>Expense.CurrencyCode</c>'s default.</para>
/// </summary>
public static class RecurringExpenseGenerator
{
    // A template back-dated by years would otherwise flood the list on its first run.
    private const int MaxCatchUp = 36;

    /// <summary>
    /// Creates one expense from a template dated <paramref name="runDate"/> and, for an auto-post
    /// template, approves, pays and posts it. Adds to the context but does NOT save or advance the
    /// schedule — the caller does both.
    /// </summary>
    public static async Task<RecurringExpenseOutcome> GenerateAsync(
        FinanceDbContext db, RecurringExpense template, DateTime runDate, CancellationToken ct)
    {
        var note = string.IsNullOrWhiteSpace(template.Notes)
            ? $"Auto-generated from recurring expense \"{template.TemplateName}\""
            : template.Notes;

        // PaidBy carries the vendor: the expense list shows it as "who", and for a subscription
        // that is the supplier, not an employee claiming it back.
        var expense = new Expense(
            template.TemplateName, template.Category, template.Amount, runDate.ToString("yyyy-MM-dd"),
            template.Vendor ?? template.TemplateName, template.PaymentMethod, template.Reference, note);
        expense.SetRecurringExpenseId(template.Id);
        expense.SetPostingAccounts(template.ExpenseAccountId, template.PaymentAccountId);
        db.Expenses.Add(expense);

        if (!template.AutoPost)
            return new RecurringExpenseOutcome(expense, Posted: false, Held: false, null);

        // Checked before approving so a closed period leaves the expense untouched in "pending",
        // where the approval queue will show it, rather than half-way through the workflow.
        if (await GlPoster.IsPeriodClosedAsync(db, expense.ExpenseDate, ct))
            return new RecurringExpenseOutcome(expense, false, true,
                $"The fiscal period for {expense.ExpenseDate} is closed, so the expense was left pending instead of being posted.");

        expense.ApproveAutomatically();
        try
        {
            await ExpensePosting.PayAndPostAsync(db, expense, ct);
            return new RecurringExpenseOutcome(expense, true, false, null);
        }
        catch (InvalidOperationException ex)
        {
            // The ledger refused it (a missing account). The expense stays approved and unpaid, so
            // "Mark as paid" retries the posting once the chart is fixed — one template's problem
            // must not stop the rest of the workspace's run.
            return new RecurringExpenseOutcome(expense, false, true,
                $"The expense was created but could not be posted to the ledger: {ex.Message}");
        }
    }

    /// <summary>Generate expenses for every template due on/before <paramref name="asOf"/>.</summary>
    public static async Task<RecurringExpenseRunResult> GenerateDueAsync(
        FinanceDbContext db, DateTime asOf, CancellationToken ct = default)
    {
        var due = await db.RecurringExpenses
            .Where(r => r.IsActive && !r.IsDeleted && r.NextRunDate <= asOf
                     && (r.EndDate == null || r.NextRunDate <= r.EndDate))
            .ToListAsync(ct);

        int created = 0, posted = 0, held = 0;

        foreach (var template in due)
        {
            // Catch up if several periods elapsed while the job was idle. Each one is dated on its
            // own run date, so the cost lands in the month it belongs to.
            var guard = 0;
            while (template.IsDue(asOf) && guard++ < MaxCatchUp)
            {
                var outcome = await GenerateAsync(db, template, template.NextRunDate, ct);
                template.AdvanceAfterGeneration();
                created++;
                if (outcome.Posted) posted++;
                if (outcome.Held)   held++;
            }
        }

        if (created > 0) await db.SaveChangesAsync(ct);

        return new RecurringExpenseRunResult(created, posted, held);
    }
}
