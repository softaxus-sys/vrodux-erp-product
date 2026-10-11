using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Reconciliation;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class GetReconciliationHandler(FinanceDbContext db) : IQueryHandler<GetReconciliationQuery, ReconciliationDto>
{
    public async Task<Result<ReconciliationDto>> Handle(GetReconciliationQuery q, CancellationToken ct)
    {
        var window = ReconciliationEngine.ClampWindow(q.WindowDays);
        var d = await ReconciliationEngine.LoadAsync(db, q.BankAccountId, window, ct);
        if (d is null) return Result.Failure<ReconciliationDto>(Error.NotFoundById("BankAccount", q.BankAccountId));

        var bank = d.Bank.Select(t => new ReconBankItemDto(t.Id, t.Date, t.Description, t.Reference, t.Amount, t.Type == "credit",
            d.Suggestions.TryGetValue(t.Id, out var s) ? s : [])).ToList();
        decimal bankNet = d.Bank.Sum(t => t.Type == "credit" ? t.Amount : -t.Amount);
        decimal bookNet = d.Book.Sum(b => b.In ? b.Amount : -b.Amount);

        return Result.Success(new ReconciliationDto(d.Account.Id, d.Account.AccountName, d.Account.Currency,
            d.Account.LedgerAccountId, d.Ledger?.AccountNumber, d.Ledger?.Name,
            d.Account.Balance, d.BookBalance, d.Account.Balance - d.BookBalance,
            bankNet, bookNet, d.MatchedCount, window, d.Truncated, bank, d.Book));
    }
}

internal sealed class SetBankLedgerAccountHandler(FinanceDbContext db) : ICommandHandler<SetBankLedgerAccountCommand>
{
    public async Task<Result> Handle(SetBankLedgerAccountCommand cmd, CancellationToken ct)
    {
        var account = await db.BankAccounts.FirstOrDefaultAsync(x => x.Id == cmd.BankAccountId && !x.IsDeleted, ct);
        if (account is null) return Result.Failure(Error.NotFoundById("BankAccount", cmd.BankAccountId));

        if (cmd.LedgerAccountId is Guid id)
        {
            var ok = await db.Accounts.AnyAsync(a => a.Id == id && !a.IsDeleted && a.IsActive, ct);
            if (!ok) return Result.Failure(Error.Custom("Account.NotFound", "That ledger account does not exist or is switched off."));
        }
        // Matches were made against the previous ledger account; leaving them would pair statement lines with the wrong books.
        if (account.LedgerAccountId != cmd.LedgerAccountId
            && await db.BankTransactions.AnyAsync(t => t.AccountId == account.Id && t.MatchedJournalLineId != null, ct))
            return Result.Failure(Error.Custom("BankReconciliation.Conflict", "Unmatch this account's matched lines before changing its ledger account."));

        account.SetLedgerAccount(cmd.LedgerAccountId);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class MatchBankTransactionHandler(FinanceDbContext db) : ICommandHandler<MatchBankTransactionCommand>
{
    public async Task<Result> Handle(MatchBankTransactionCommand cmd, CancellationToken ct)
    {
        var txn = await db.BankTransactions.FirstOrDefaultAsync(x => x.Id == cmd.TransactionId, ct);
        if (txn is null) return Result.Failure(Error.NotFoundById("BankTransaction", cmd.TransactionId));
        if (txn.MatchedJournalLineId is not null)
            return Result.Failure(Error.Custom("BankReconciliation.Conflict", "This statement line is already matched. Unmatch it first."));

        var account = await db.BankAccounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == txn.AccountId, ct);
        if (account?.LedgerAccountId is not Guid ledgerId)
            return Result.Failure(Error.Custom("BankReconciliation.Conflict", "Choose this bank account's ledger account before matching."));

        var line = await db.JournalLines.Include(l => l.JournalEntry).FirstOrDefaultAsync(l => l.Id == cmd.JournalLineId, ct);
        if (line?.JournalEntry is null || line.JournalEntry.IsDeleted || line.JournalEntry.Status != "posted")
            return Result.Failure(Error.Custom("JournalEntry.NotFound", "That ledger line is not on a posted journal entry."));
        if (line.AccountId != ledgerId)
            return Result.Failure(Error.Custom("BankReconciliation.Conflict", "That ledger line is not on this bank account's ledger account."));

        var lineIsIn = line.DebitAmount > 0;
        var amount = lineIsIn ? line.DebitAmount : line.CreditAmount;
        if (lineIsIn != (txn.Type == "credit") || amount != txn.Amount)
            return Result.Failure(Error.Custom("BankReconciliation.Conflict",
                "The amount or direction does not agree: a statement line pairs with a ledger line of the same amount going the same way."));
        if (await db.BankTransactions.AnyAsync(t => t.MatchedJournalLineId == line.Id, ct))
            return Result.Failure(Error.Custom("BankReconciliation.Conflict", "That ledger line is already matched to another statement line."));

        txn.Match(line.Id, line.JournalEntryId, line.JournalEntry.EntryNumber, cmd.UserName);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class UnmatchBankTransactionHandler(FinanceDbContext db) : ICommandHandler<UnmatchBankTransactionCommand>
{
    public async Task<Result> Handle(UnmatchBankTransactionCommand cmd, CancellationToken ct)
    {
        var txn = await db.BankTransactions.FirstOrDefaultAsync(x => x.Id == cmd.TransactionId, ct);
        if (txn is null) return Result.Failure(Error.NotFoundById("BankTransaction", cmd.TransactionId));
        if (txn.MatchedJournalLineId is null)
            return Result.Failure(Error.Custom("BankReconciliation.Conflict", "This statement line is not matched to a ledger entry."));
        txn.Unmatch();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class AutoMatchBankTransactionsHandler(FinanceDbContext db) : ICommandHandler<AutoMatchBankTransactionsCommand, int>
{
    public async Task<Result<int>> Handle(AutoMatchBankTransactionsCommand cmd, CancellationToken ct)
    {
        var d = await ReconciliationEngine.LoadAsync(db, cmd.BankAccountId, ReconciliationEngine.ClampWindow(cmd.WindowDays), ct);
        if (d is null) return Result.Failure<int>(Error.NotFoundById("BankAccount", cmd.BankAccountId));
        if (d.Ledger is null)
            return Result.Failure<int>(Error.Custom("BankReconciliation.Conflict", "Choose this bank account's ledger account before matching."));

        // Only a pair that is the single choice from both sides is safe to settle without a person.
        var claims = d.Suggestions.Values.SelectMany(v => v).GroupBy(x => x).ToDictionary(g => g.Key, g => g.Count());
        var pairs = d.Suggestions.Where(kv => kv.Value.Count == 1 && claims[kv.Value[0]] == 1).ToList();
        if (pairs.Count == 0) return Result.Success(0);

        var ids = pairs.Select(p => p.Key).ToList();
        var txns = await db.BankTransactions.Where(t => ids.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);
        var book = d.Book.ToDictionary(b => b.JournalLineId);
        var n = 0;
        foreach (var (txnId, lines) in pairs)
        {
            var b = book[lines[0]];
            txns[txnId].Match(b.JournalLineId, b.JournalEntryId, b.EntryNumber, cmd.UserName);
            n++;
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(n);
    }
}
