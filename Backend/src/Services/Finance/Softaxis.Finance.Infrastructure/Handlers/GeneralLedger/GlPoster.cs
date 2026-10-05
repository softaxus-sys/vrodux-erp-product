using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Persistence.Seed;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

/// <summary>
/// Shared helper that auto-posts balanced journal entries from AR/AP/cash subledger
/// transactions (invoices, bills, receipts, payments, expenses) so the General Ledger
/// reports stay in sync with the subledgers.
/// </summary>
internal static class GlPoster
{
    public const string Cash          = "1001"; // Cash on Hand
    public const string Bank          = "1010"; // Bank - Main Account
    public const string AccountsReceivable = "1200";
    public const string AccountsPayable    = "2001";
    public const string VatPayable    = "2200"; // net VAT control account (output - input)
    public const string SalesRevenue  = "4001";
    public const string Purchases     = "5400"; // Cost of Goods Sold / Purchases
    public const string FxGainLoss    = "4950"; // Foreign Exchange Gain/Loss (net account)

    /// <summary>
    /// Every account number this poster can reference. Startup asserts the chart-of-accounts
    /// catalogue covers all of them, so a missing one is caught at boot rather than when a
    /// tenant next sends an invoice.
    /// </summary>
    public static readonly IReadOnlyList<string> RequiredAccountNumbers =
    [
        Cash, Bank, AccountsReceivable, AccountsPayable, VatPayable, SalesRevenue, Purchases, FxGainLoss,
    ];

    public sealed record Line(string AccountNumber, decimal Debit, decimal Credit, string? Description = null);

    /// <summary>Looks the posting accounts up for the current tenant (the global filter scopes this).</summary>
    private static async Task<Dictionary<string, Account>> LoadAccountsAsync(
        FinanceDbContext db, IReadOnlyList<string> accountNumbers, CancellationToken ct)
        => await db.Accounts.AsNoTracking()
            .Where(a => accountNumbers.Contains(a.AccountNumber) && !a.IsDeleted)
            .ToDictionaryAsync(a => a.AccountNumber, ct);

    /// <summary>Builds, balances, and posts a journal entry. Returns the new entry's id, or null if there were no non-zero lines.</summary>
    public static async Task<Guid?> PostAsync(
        FinanceDbContext db, string date, string description, string? reference, IReadOnlyList<Line> lines, CancellationToken ct)
    {
        var nonZeroLines = lines.Where(l => l.Debit > 0 || l.Credit > 0).ToList();
        if (nonZeroLines.Count == 0)
            return null;

        var accountNumbers = nonZeroLines.Select(l => l.AccountNumber).Distinct().ToList();
        var accounts = await LoadAccountsAsync(db, accountNumbers, ct);

        // A tenant created since the last startup backfill has no chart of accounts yet. Provision
        // the standard chart for it on demand rather than failing the invoice/bill it is posting.
        if (accountNumbers.Any(number => !accounts.ContainsKey(number)) && TenantAmbient.TenantId is { } tenantId)
        {
            await ChartOfAccountsProvisioner.EnsureForTenantAsync(db, tenantId, ct);
            await db.SaveChangesAsync(ct);
            accounts = await LoadAccountsAsync(db, accountNumbers, ct);
        }

        var entry = new JournalEntry(date, description, reference, null);
        foreach (var line in nonZeroLines)
        {
            if (!accounts.TryGetValue(line.AccountNumber, out var account))
                throw new InvalidOperationException(
                    $"GL account '{line.AccountNumber}' was not found for this tenant while auto-posting " +
                    $"'{description}'. The standard chart of accounts should be provisioned automatically — " +
                    $"if this persists, check that the account exists and is not soft-deleted.");

            entry.Lines.Add(new JournalEntryLine(entry.Id, account.Id, account.Name, line.Debit, line.Credit, line.Description));
        }

        if (!entry.IsBalanced)
            throw new InvalidOperationException($"Auto-posted journal entry for '{description}' is not balanced (debit {entry.TotalDebit} vs credit {entry.TotalCredit}).");

        entry.Post();
        db.JournalEntries.Add(entry);

        return entry.Id;
    }

    /// <summary>
    /// Posts the sales entry an invoice raises when it goes out: receivable debited, revenue
    /// credited, VAT credited when there is any.
    ///
    /// <para>Shared by the manual send and the scheduled send. It was written out longhand in the
    /// handler; a second copy in the scheduler is exactly how the two would come to disagree about
    /// which account VAT lands in.</para>
    /// </summary>
    public static async Task<Guid?> PostInvoiceSalesAsync(
        FinanceDbContext db, Invoice invoice, CancellationToken ct)
    {
        var rate = await GetRateAsync(db, invoice.CurrencyCode, invoice.InvoiceDate, ct);

        var lines = new List<Line>
        {
            new(AccountsReceivable, invoice.Total * rate, 0, $"Invoice {invoice.InvoiceNumber} - {invoice.CustomerName}"),
            new(SalesRevenue, 0, invoice.SubTotal * rate, $"Sales - Invoice {invoice.InvoiceNumber}"),
        };

        if (invoice.TaxAmount > 0)
            lines.Add(new(VatPayable, 0, invoice.TaxAmount * rate, $"VAT Output - Invoice {invoice.InvoiceNumber}"));

        return await PostAsync(db, invoice.InvoiceDate, $"Sales Invoice {invoice.InvoiceNumber}",
            invoice.InvoiceNumber, lines, ct);
    }

    /// <summary>Reverses (voids) a previously auto-posted journal entry, if any.</summary>
    public static async Task VoidAsync(FinanceDbContext db, Guid? journalEntryId, CancellationToken ct)
    {
        if (journalEntryId is null)
            return;

        var entry = await db.JournalEntries.FindAsync([journalEntryId.Value], ct);
        if (entry is not null && entry.Status == "posted")
            entry.Void();
    }

    /// <summary>
    /// Returns how many units of the WORKSPACE'S OWN currency one unit of
    /// <paramref name="currencyCode"/> is worth as of <paramref name="date"/> — the multiplier that
    /// turns a document amount into a ledger amount.
    ///
    /// <para>The ledger is kept in the workspace's operating currency, because that is the currency
    /// every report labels its figures with. This used to return the stored exchange rate as-is,
    /// which is quoted against the platform's base currency (USD) — so a PKR workspace booking a
    /// 1,000 PKR expense posted 3.61 to the ledger and then saw it reported as "PKR 4".</para>
    ///
    /// <para>Returns 1 when the document is already in the workspace currency, or when either rate
    /// is missing (posting the amount unconverted beats refusing to post).</para>
    /// </summary>
    public static async Task<decimal> GetRateAsync(FinanceDbContext db, string currencyCode, string date, CancellationToken ct)
    {
        var code       = currencyCode.Trim().ToUpperInvariant();
        var functional = TenantCurrency.Resolve().Trim().ToUpperInvariant();
        if (code == functional)
            return 1m;

        var baseCode = (await db.Currencies.AsNoTracking()
            .Where(c => c.IsBaseCurrency)
            .Select(c => c.Code)
            .FirstOrDefaultAsync(ct))?.Trim().ToUpperInvariant() ?? "USD";

        var documentRate   = await BasePerUnitAsync(db, code, baseCode, date, ct);
        var functionalRate = await BasePerUnitAsync(db, functional, baseCode, date, ct);

        if (documentRate is null || functionalRate is null || functionalRate.Value == 0m)
            return 1m;

        return documentRate.Value / functionalRate.Value;
    }

    /// <summary>
    /// Base-currency units per one unit of <paramref name="code"/> — the most recent stored rate on
    /// or before <paramref name="date"/>, else the most recent overall. Null when none is recorded.
    /// </summary>
    private static async Task<decimal?> BasePerUnitAsync(
        FinanceDbContext db, string code, string baseCode, string date, CancellationToken ct)
    {
        if (code == baseCode)
            return 1m;

        var rates = await db.ExchangeRates.AsNoTracking()
            .Where(r => r.CurrencyCode == code)
            .ToListAsync(ct);

        if (rates.Count == 0)
            return null;

        var onOrBefore = rates.Where(r => string.CompareOrdinal(r.RateDate, date) <= 0)
            .OrderByDescending(r => r.RateDate).FirstOrDefault();

        return (onOrBefore ?? rates.OrderByDescending(r => r.RateDate).First()).Rate;
    }

    /// <summary>Returns true if the fiscal period containing <paramref name="date"/> ("yyyy-MM-dd") is closed.</summary>
    public static async Task<bool> IsPeriodClosedAsync(FinanceDbContext db, string date, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(date) || date.Length < 7)
            return false;

        var periodCode = date[..7];
        var period = await db.FiscalPeriods.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PeriodCode == periodCode, ct);

        return period?.Status == "closed";
    }

    /// <summary>Maps a receipt/payment/expense payment method to the GL cash or bank account.</summary>
    public static string ResolveCashAccount(string? method) =>
        string.Equals(method?.Trim(), "cash", StringComparison.OrdinalIgnoreCase) ? Cash : Bank;

    /// <summary>Maps an expense category to its GL expense account, defaulting to Miscellaneous Expenses.</summary>
    public static string ResolveExpenseAccount(string category) => category.Trim().ToLowerInvariant() switch
    {
        "salary" or "salaries" or "payroll" => "5001",
        "rent"                              => "5100",
        "utilities"                         => "5200",
        "marketing"                         => "5300",
        "travel"                            => "5600",
        "telecom" or "telecommunications"   => "5700",
        "insurance"                         => "5800",
        _                                   => "5900",
    };
}
