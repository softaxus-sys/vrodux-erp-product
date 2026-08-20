using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

/// <summary>
/// Computes an account's <b>current</b> balance = its opening balance plus every posted journal
/// movement.
///
/// <para><b>Why this is needed.</b> <see cref="Account.Balance"/> is the <i>opening</i> balance —
/// it is set once when the account is created and <c>AdjustBalance</c> is never called anywhere in
/// the codebase. The GL reports already understand this and compute
/// <c>Balance + movements</c> (see <c>GetTrialBalanceHandler</c> / <c>GetBalanceSheetHandler</c>),
/// but the Chart of Accounts screen was returning the raw opening balance, so every account read
/// $0.00 for a real tenant no matter how much had been posted to it.</para>
///
/// <para>Movements use the <b>natural balance</b> convention already used by the balance sheet and
/// P&amp;L: debit-normal accounts (assets, expenses) net as <c>debit - credit</c>, credit-normal
/// accounts (liabilities, equity, income) as <c>credit - debit</c>, so a revenue account with
/// credits shows as a positive figure rather than a negative one.</para>
/// </summary>
internal static class AccountBalances
{
    internal readonly record struct Movement(decimal Debits, decimal Credits);

    /// <summary>Posted debit/credit totals per account id. Only <c>posted</c> entries count — drafts and voided entries are excluded.</summary>
    public static async Task<Dictionary<Guid, Movement>> LoadMovementsAsync(
        FinanceDbContext db, CancellationToken ct)
        => await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")
            .GroupBy(l => l.AccountId)
            .Select(g => new
            {
                AccountId = g.Key,
                Debits    = g.Sum(l => l.DebitAmount),
                Credits   = g.Sum(l => l.CreditAmount),
            })
            .ToDictionaryAsync(x => x.AccountId, x => new Movement(x.Debits, x.Credits), ct);

    /// <summary>
    /// Normal balance for an account type code. Tenants can define their own account types, so the
    /// tenant's <see cref="AccountType.NormalBalance"/> wins when one matches; otherwise the five
    /// standard classifications are assumed, defaulting to debit-normal for anything unrecognised.
    /// </summary>
    public static bool IsDebitNormal(string accountType, IReadOnlyDictionary<string, string> normalBalanceByTypeCode)
    {
        if (normalBalanceByTypeCode.TryGetValue(accountType, out var normal))
            return !string.Equals(normal, "credit", StringComparison.OrdinalIgnoreCase);

        return accountType.ToLowerInvariant() switch
        {
            "liability" or "equity" or "income" => false,
            _ => true, // asset, expense, and any unknown/custom type
        };
    }

    /// <summary>Loads each account type's normal balance, keyed by its code.</summary>
    public static async Task<Dictionary<string, string>> LoadNormalBalancesAsync(
        FinanceDbContext db, CancellationToken ct)
        => await db.AccountTypes.AsNoTracking()
            .ToDictionaryAsync(x => x.Code, x => x.NormalBalance, StringComparer.OrdinalIgnoreCase, ct);

    /// <summary>Opening balance + posted movements, signed by the account's natural balance.</summary>
    public static decimal Current(
        Account account,
        IReadOnlyDictionary<Guid, Movement> movements,
        IReadOnlyDictionary<string, string> normalBalanceByTypeCode)
    {
        if (!movements.TryGetValue(account.Id, out var m))
            return account.Balance;

        var movement = IsDebitNormal(account.AccountType, normalBalanceByTypeCode)
            ? m.Debits - m.Credits
            : m.Credits - m.Debits;

        return Math.Round(account.Balance + movement, 2);
    }
}
