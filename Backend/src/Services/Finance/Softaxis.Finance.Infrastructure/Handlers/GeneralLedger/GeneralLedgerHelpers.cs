using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class PostedLine
{
    public Guid    AccountId { get; set; }
    public decimal Debit     { get; set; }
    public decimal Credit    { get; set; }
    public string  Date      { get; set; } = "";
}

internal static class GeneralLedgerHelpers
{
    public static async Task<(List<Account> accounts, List<PostedLine> lines)> LoadPostedAsync(FinanceDbContext db, CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => !x.IsDeleted).OrderBy(x => x.AccountNumber).ToListAsync(ct);

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")
            .Select(l => new PostedLine
            {
                AccountId = l.AccountId,
                Debit     = l.DebitAmount,
                Credit    = l.CreditAmount,
                Date      = l.JournalEntry!.Date,
            })
            .ToListAsync(ct);

        return (accounts, lines);
    }
}
