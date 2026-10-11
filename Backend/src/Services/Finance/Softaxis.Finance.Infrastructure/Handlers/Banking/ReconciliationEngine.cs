using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Application.Banking.Reconciliation;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

/// <summary>What is still open on one bank account, and which open lines could be paired.</summary>
internal sealed record ReconciliationData(
    BankAccount Account, Account? Ledger, List<BankTransaction> Bank, List<ReconBookItemDto> Book,
    decimal BookBalance, int MatchedCount, bool Truncated,
    Dictionary<Guid, List<Guid>> Suggestions);

internal static class ReconciliationEngine
{
    public const int Cap = 500;
    public const int MaxWindow = 60;

    public static int ClampWindow(int days) => Math.Clamp(days, 0, MaxWindow);

    public static async Task<ReconciliationData?> LoadAsync(FinanceDbContext db, Guid accountId, int windowDays, CancellationToken ct)
    {
        var account = await db.BankAccounts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == accountId && !x.IsDeleted, ct);
        if (account is null) return null;

        var matchedCount = await db.BankTransactions.CountAsync(x => x.AccountId == accountId && x.MatchedJournalLineId != null, ct);
        var bank = await db.BankTransactions.AsNoTracking()
            .Where(x => x.AccountId == accountId && x.MatchedJournalLineId == null && !x.Reconciled)
            .OrderBy(x => x.Date).ThenBy(x => x.CreatedAt).Take(Cap + 1).ToListAsync(ct);
        var truncated = bank.Count > Cap;
        if (truncated) bank = bank.Take(Cap).ToList();

        Account? ledger = null;
        var book = new List<ReconBookItemDto>();
        decimal bookBalance = 0;
        if (account.LedgerAccountId is Guid lid)
        {
            ledger = await db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == lid && !a.IsDeleted, ct);
            if (ledger is not null)
            {
                // Posted, live entries only. The tenant filter replaces any entity soft-delete filter, so IsDeleted is applied by hand.
                var lines = db.JournalLines.AsNoTracking()
                    .Where(l => l.AccountId == lid && l.JournalEntry!.Status == "posted" && !l.JournalEntry.IsDeleted);
                bookBalance = await lines.SumAsync(l => (decimal?)(l.DebitAmount - l.CreditAmount), ct) ?? 0;

                var matchedLines = db.BankTransactions.Where(t => t.MatchedJournalLineId != null).Select(t => t.MatchedJournalLineId!.Value);
                var open = await lines.Where(l => !matchedLines.Contains(l.Id))
                    .OrderBy(l => l.JournalEntry!.Date)
                    .Select(l => new
                    {
                        l.Id, l.JournalEntryId, l.JournalEntry!.EntryNumber, l.JournalEntry.Date,
                        Description = l.Description ?? l.JournalEntry.Description, l.DebitAmount, l.CreditAmount,
                    })
                    .Take(Cap).ToListAsync(ct);
                book = open.Select(l => new ReconBookItemDto(l.Id, l.JournalEntryId, l.EntryNumber, l.Date, l.Description,
                    l.DebitAmount > 0 ? l.DebitAmount : l.CreditAmount, l.DebitAmount > 0)).ToList();
            }
        }

        return new ReconciliationData(account, ledger, bank, book, bookBalance, matchedCount, truncated,
            Suggest(bank, book, windowDays));
    }

    /// <summary>Money in at the bank (credit) pairs with a debit to the bank account in the books, and the reverse. Exact amount, date within the window.</summary>
    public static Dictionary<Guid, List<Guid>> Suggest(List<BankTransaction> bank, List<ReconBookItemDto> book, int windowDays)
    {
        var result = new Dictionary<Guid, List<Guid>>();
        var byAmount = book.GroupBy(b => (b.Amount, b.In)).ToDictionary(g => g.Key, g => g.ToList());
        foreach (var t in bank)
        {
            if (!DateOnly.TryParse(t.Date, out var td)) continue;
            var isIn = t.Type == "credit";
            if (!byAmount.TryGetValue((t.Amount, isIn), out var cands)) continue;
            var near = cands
                .Select(c => (c, diff: DateOnly.TryParse(c.Date, out var cd) ? Math.Abs(cd.DayNumber - td.DayNumber) : int.MaxValue))
                .Where(x => x.diff <= windowDays).OrderBy(x => x.diff).Select(x => x.c.JournalLineId).ToList();
            if (near.Count > 0) result[t.Id] = near;
        }
        return result;
    }
}
