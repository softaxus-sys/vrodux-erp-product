namespace Softaxis.Finance.Infrastructure.Persistence.Seed;

/// <summary>
/// The standard account-type + chart-of-accounts catalogue every tenant starts with, used by
/// <see cref="ChartOfAccountsProvisioner"/> to materialise a per-tenant copy.
///
/// <para><b>Kept in sync by hand with <see cref="FinanceSeedData"/></b>, which holds its own copy
/// (with fixed GUIDs and demo opening balances) for the legacy global/demo dataset. The two lists
/// are intentionally separate — the demo seed needs stable GUIDs, a per-tenant copy cannot reuse
/// them without primary-key collisions — so <b>an account added there must be added here too</b>,
/// or tenants will not get it.</para>
///
/// <para>The account numbers here are load-bearing: <c>GlPoster</c> looks accounts up by number
/// when auto-posting invoices, bills, receipts, payments and expenses. <c>AssertCoversGlPoster</c>
/// guards the numbers <c>GlPoster</c> depends on; removing or renumbering any other entry will not
/// be caught automatically.</para>
/// </summary>
internal static class ChartOfAccountsCatalogue
{
    internal readonly record struct AccountTypeDef(string Code, string Name, string NormalBalance, int SortOrder);

    internal readonly record struct AccountDef(string Number, string Name, string TypeCode);

    internal static readonly AccountTypeDef[] AccountTypes =
    [
        new("asset",     "Asset",     "debit",  1),
        new("liability", "Liability", "credit", 2),
        new("equity",    "Equity",    "credit", 3),
        new("income",    "Income",    "credit", 4),
        new("expense",   "Expense",   "debit",  5),
    ];

    internal static readonly AccountDef[] Accounts =
    [
        // Assets
        new("1001", "Cash on Hand",               "asset"),
        new("1010", "Bank — Main Account",         "asset"),
        new("1011", "Bank — Savings Account",      "asset"),
        new("1200", "Accounts Receivable",         "asset"),
        new("1300", "Inventory",                   "asset"),
        new("1400", "Prepaid Expenses",            "asset"),
        new("1500", "Property, Plant & Equipment", "asset"),
        new("1510", "Accumulated Depreciation",    "asset"),
        // Liabilities
        new("2001", "Accounts Payable",            "liability"),
        new("2100", "Salaries Payable",            "liability"),
        new("2200", "VAT Payable",                 "liability"),
        new("2300", "Bank Loan Payable",           "liability"),
        new("2400", "Accrued Expenses",            "liability"),
        // Equity
        new("3001", "Share Capital",               "equity"),
        new("3100", "Retained Earnings",           "equity"),
        // Income
        new("4001", "Sales Revenue",               "income"),
        new("4002", "Service Revenue",             "income"),
        new("4900", "Other Income",                "income"),
        new("4950", "Foreign Exchange Gain/Loss",  "income"),
        // Expenses
        new("5001", "Salaries & Wages",            "expense"),
        new("5100", "Rent Expense",                "expense"),
        new("5200", "Utilities",                   "expense"),
        new("5300", "Marketing & Advertising",     "expense"),
        new("5400", "Cost of Goods Sold",          "expense"),
        new("5500", "Depreciation Expense",        "expense"),
        new("5600", "Travel & Accommodation",      "expense"),
        new("5700", "Telecommunications",          "expense"),
        new("5800", "Insurance",                   "expense"),
        new("5900", "Miscellaneous Expenses",      "expense"),
    ];

    /// <summary>
    /// Fails fast at startup if the catalogue no longer covers every account number
    /// <c>GlPoster</c> posts to. Without this, dropping one of those numbers here would compile
    /// fine and only surface as a runtime "GL account 'x' was not found" the next time a tenant
    /// sent an invoice.
    /// </summary>
    internal static void AssertCoversGlPoster(IEnumerable<string> requiredAccountNumbers)
    {
        var have = Accounts.Select(a => a.Number).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = requiredAccountNumbers.Where(n => !have.Contains(n)).ToList();
        if (missing.Count > 0)
            throw new InvalidOperationException(
                "ChartOfAccountsCatalogue is missing GL account number(s) required by GlPoster: " +
                $"{string.Join(", ", missing)}. Add them to the catalogue, or GL auto-posting will " +
                "fail at runtime for every tenant.");
    }
}
