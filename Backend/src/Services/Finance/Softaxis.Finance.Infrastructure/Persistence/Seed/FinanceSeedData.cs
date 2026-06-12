using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Seed;

/// <summary>
/// Idempotent seed data for the Finance module.
/// Safe to re-run — checks by fixed GUID before inserting.
/// </summary>
public static class FinanceSeedData
{
    // A stable "finance manager" GUID used as approverId for expenses
    private static readonly Guid FinanceManagerId = new("f1000001-0000-0000-0000-000000000001");

    public static async Task SeedAsync(FinanceDbContext db)
    {
        await SeedAccountTypesAsync(db);
        await SeedCurrenciesAsync(db);
        await db.SaveChangesAsync();
        await SeedAccountsAsync(db);
        await db.SaveChangesAsync();
        await SeedExpensesAsync(db);
        await db.SaveChangesAsync();
        await SeedInvoicesAsync(db);
        await db.SaveChangesAsync();
        await SeedBudgetsAsync(db);
        await db.SaveChangesAsync();
        await SeedJournalsAsync(db);
        await db.SaveChangesAsync();
    }

    // ── Account Types ─────────────────────────────────────────────────────────

    private static readonly Guid AccTypeAsset     = new("a1000001-0000-0000-0000-000000000001");
    private static readonly Guid AccTypeLiability = new("a1000001-0000-0000-0000-000000000002");
    private static readonly Guid AccTypeEquity    = new("a1000001-0000-0000-0000-000000000003");
    private static readonly Guid AccTypeIncome    = new("a1000001-0000-0000-0000-000000000004");
    private static readonly Guid AccTypeExpense   = new("a1000001-0000-0000-0000-000000000005");

    private static async Task SeedAccountTypesAsync(FinanceDbContext db)
    {
        var existing = await db.AccountTypes.IgnoreQueryFilters()
            .Select(x => x.Id).ToHashSetAsync();

        var types = new[]
        {
            (AccTypeAsset,     "asset",     "Asset",     "debit",  1),
            (AccTypeLiability, "liability", "Liability", "credit", 2),
            (AccTypeEquity,    "equity",    "Equity",    "credit", 3),
            (AccTypeIncome,    "income",    "Income",    "credit", 4),
            (AccTypeExpense,   "expense",   "Expense",   "debit",  5),
        };

        foreach (var (id, code, name, normalBalance, sortOrder) in types)
        {
            if (existing.Contains(id)) continue;
            var type = new AccountType(code, name, normalBalance, sortOrder);
            SetId(type, id);
            db.AccountTypes.Add(type);
        }
    }

    // ── Currencies ────────────────────────────────────────────────────────────

    private static async Task SeedCurrenciesAsync(FinanceDbContext db)
    {
        var existing = await db.Currencies.IgnoreQueryFilters()
            .Select(x => x.Id).ToHashSetAsync();

        var currencies = new[]
        {
            (new Guid("a2000002-0000-0000-0000-000000000001"), "AED", "UAE Dirham",       "د.إ", 2, true),
            (new Guid("a2000002-0000-0000-0000-000000000002"), "USD", "US Dollar",        "$",   2, false),
            (new Guid("a2000002-0000-0000-0000-000000000003"), "EUR", "Euro",             "€",   2, false),
            (new Guid("a2000002-0000-0000-0000-000000000004"), "GBP", "British Pound",    "£",   2, false),
            (new Guid("a2000002-0000-0000-0000-000000000005"), "SAR", "Saudi Riyal",      "ر.س", 2, false),
            (new Guid("a2000002-0000-0000-0000-000000000006"), "KWD", "Kuwaiti Dinar",    "د.ك", 3, false),
            (new Guid("a2000002-0000-0000-0000-000000000007"), "BHD", "Bahraini Dinar",   "د.ب", 3, false),
            (new Guid("a2000002-0000-0000-0000-000000000008"), "OMR", "Omani Rial",       "ر.ع.", 3, false),
        };

        foreach (var (id, code, name, symbol, decimalPlaces, isBase) in currencies)
        {
            if (existing.Contains(id)) continue;
            var currency = new Currency(code, name, symbol, decimalPlaces, isBase);
            SetId(currency, id);
            db.Currencies.Add(currency);
        }
    }

    // ── Chart of Accounts ─────────────────────────────────────────────────────

    // Asset accounts
    private static readonly Guid AccCash            = new("b1000001-0000-0000-0000-000000000001");
    private static readonly Guid AccBankMain         = new("b1000001-0000-0000-0000-000000000002");
    private static readonly Guid AccBankSavings      = new("b1000001-0000-0000-0000-000000000003");
    private static readonly Guid AccAccountsRec      = new("b1000001-0000-0000-0000-000000000004");
    private static readonly Guid AccInventory        = new("b1000001-0000-0000-0000-000000000005");
    private static readonly Guid AccPrepaidExp       = new("b1000001-0000-0000-0000-000000000006");
    private static readonly Guid AccFixedAssets      = new("b1000001-0000-0000-0000-000000000007");
    private static readonly Guid AccAccumDeprec      = new("b1000001-0000-0000-0000-000000000008");
    // Liability accounts
    private static readonly Guid AccAccountsPay      = new("b1000001-0000-0000-0000-000000000011");
    private static readonly Guid AccSalariesPay      = new("b1000001-0000-0000-0000-000000000012");
    private static readonly Guid AccVatPayable       = new("b1000001-0000-0000-0000-000000000013");
    private static readonly Guid AccLoanPayable      = new("b1000001-0000-0000-0000-000000000014");
    private static readonly Guid AccAccruedExp       = new("b1000001-0000-0000-0000-000000000015");
    // Equity accounts
    private static readonly Guid AccShareCapital     = new("b1000001-0000-0000-0000-000000000021");
    private static readonly Guid AccRetainedEarnings = new("b1000001-0000-0000-0000-000000000022");
    // Income accounts
    private static readonly Guid AccRevenueSales     = new("b1000001-0000-0000-0000-000000000031");
    private static readonly Guid AccRevenueServices  = new("b1000001-0000-0000-0000-000000000032");
    private static readonly Guid AccOtherIncome      = new("b1000001-0000-0000-0000-000000000033");
    // Expense accounts
    private static readonly Guid AccSalaryExp        = new("b1000001-0000-0000-0000-000000000041");
    private static readonly Guid AccRentExp          = new("b1000001-0000-0000-0000-000000000042");
    private static readonly Guid AccUtilitiesExp     = new("b1000001-0000-0000-0000-000000000043");
    private static readonly Guid AccMarketingExp     = new("b1000001-0000-0000-0000-000000000044");
    private static readonly Guid AccCOGS             = new("b1000001-0000-0000-0000-000000000045");
    private static readonly Guid AccDepreciation     = new("b1000001-0000-0000-0000-000000000046");
    private static readonly Guid AccTravelExp        = new("b1000001-0000-0000-0000-000000000047");
    private static readonly Guid AccTelecomExp       = new("b1000001-0000-0000-0000-000000000048");
    private static readonly Guid AccInsuranceExp     = new("b1000001-0000-0000-0000-000000000049");
    private static readonly Guid AccMiscExp          = new("b1000001-0000-0000-0000-000000000050");

    private static async Task SeedAccountsAsync(FinanceDbContext db)
    {
        var existing = await db.Accounts.IgnoreQueryFilters()
            .Select(a => a.Id).ToHashSetAsync();

        var accounts = new[]
        {
            // Assets
            (AccCash,             "1001", "Cash on Hand",              "asset",     (Guid?)null,   50000m),
            (AccBankMain,         "1010", "Bank — Main Account",        "asset",     (Guid?)null,   1850000m),
            (AccBankSavings,      "1011", "Bank — Savings Account",     "asset",     (Guid?)null,   500000m),
            (AccAccountsRec,      "1200", "Accounts Receivable",        "asset",     (Guid?)null,   320000m),
            (AccInventory,        "1300", "Inventory",                  "asset",     (Guid?)null,   450000m),
            (AccPrepaidExp,       "1400", "Prepaid Expenses",           "asset",     (Guid?)null,   24000m),
            (AccFixedAssets,      "1500", "Property, Plant & Equipment","asset",     (Guid?)null,   2800000m),
            (AccAccumDeprec,      "1510", "Accumulated Depreciation",   "asset",     (Guid?)null,   -380000m),
            // Liabilities
            (AccAccountsPay,      "2001", "Accounts Payable",           "liability", (Guid?)null,   185000m),
            (AccSalariesPay,      "2100", "Salaries Payable",           "liability", (Guid?)null,   210000m),
            (AccVatPayable,       "2200", "VAT Payable",                "liability", (Guid?)null,   45000m),
            (AccLoanPayable,      "2300", "Bank Loan Payable",          "liability", (Guid?)null,   800000m),
            (AccAccruedExp,       "2400", "Accrued Expenses",           "liability", (Guid?)null,   35000m),
            // Equity
            (AccShareCapital,     "3001", "Share Capital",              "equity",    (Guid?)null,   3000000m),
            (AccRetainedEarnings, "3100", "Retained Earnings",          "equity",    (Guid?)null,   1339000m),  // balances opening A=L+E
            // Income
            (AccRevenueSales,     "4001", "Sales Revenue",              "income",    (Guid?)null,   2850000m),
            (AccRevenueServices,  "4002", "Service Revenue",            "income",    (Guid?)null,   680000m),
            (AccOtherIncome,      "4900", "Other Income",               "income",    (Guid?)null,   24000m),
            // Expenses
            (AccSalaryExp,        "5001", "Salaries & Wages",           "expense",   (Guid?)null,   1260000m),
            (AccRentExp,          "5100", "Rent Expense",               "expense",   (Guid?)null,   180000m),
            (AccUtilitiesExp,     "5200", "Utilities",                  "expense",   (Guid?)null,   36000m),
            (AccMarketingExp,     "5300", "Marketing & Advertising",    "expense",   (Guid?)null,   95000m),
            (AccCOGS,             "5400", "Cost of Goods Sold",         "expense",   (Guid?)null,   1420000m),
            (AccDepreciation,     "5500", "Depreciation Expense",       "expense",   (Guid?)null,   96000m),
            (AccTravelExp,        "5600", "Travel & Accommodation",     "expense",   (Guid?)null,   42000m),
            (AccTelecomExp,       "5700", "Telecommunications",         "expense",   (Guid?)null,   18000m),
            (AccInsuranceExp,     "5800", "Insurance",                  "expense",   (Guid?)null,   24000m),
            (AccMiscExp,          "5900", "Miscellaneous Expenses",     "expense",   (Guid?)null,   12000m),
        };

        var accountTypeIdByCode = new Dictionary<string, Guid>
        {
            ["asset"]     = AccTypeAsset,
            ["liability"] = AccTypeLiability,
            ["equity"]    = AccTypeEquity,
            ["income"]    = AccTypeIncome,
            ["expense"]   = AccTypeExpense,
        };

        foreach (var (id, number, name, type, parentId, balance) in accounts)
        {
            if (existing.Contains(id)) continue;
            var acc = new Account(number, name, type, null, parentId);
            SetId(acc, id);
            SetProp(acc, "Balance", balance);
            acc.SetAccountTypeId(accountTypeIdByCode[type]);
            db.Accounts.Add(acc);
        }
    }

    // ── Expenses ──────────────────────────────────────────────────────────────

    private static async Task SeedExpensesAsync(FinanceDbContext db)
    {
        var existing = await db.Expenses.IgnoreQueryFilters()
            .Select(e => e.Id).ToHashSetAsync();

        var expenses = new[]
        {
            (new Guid("b2000002-0000-0000-0000-000000000001"), "Office Rent — March 2026",      "Rent",       15000m,  "2026-03-01", "Finance Team",       "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000002"), "AWS Cloud Services — March",    "IT",         8500m,   "2026-03-05", "IT Team",            "card",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000003"), "LinkedIn Ads — March",          "Marketing",  12000m,  "2026-03-07", "Maya Patel",         "card",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000004"), "Business Trip — Dubai Expo",    "Travel",     4200m,   "2026-03-12", "Omar Abdullah",      "cash",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000005"), "Office Supplies — Q1",          "Office",     1850m,   "2026-03-15", "Samira Hamed",       "cash",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000006"), "Annual Insurance Premium",      "Insurance",  22000m,  "2026-03-20", "Finance Team",       "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000007"), "Office Rent — April 2026",      "Rent",       15000m,  "2026-04-01", "Finance Team",       "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000008"), "Software Licenses Q2",          "IT",         6200m,   "2026-04-03", "IT Team",            "card",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000009"), "Team Building Event",           "HR",         8500m,   "2026-04-10", "Fatima Hassan",      "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000010"), "Digital Marketing Campaign",    "Marketing",  18000m,  "2026-04-15", "Karim Benali",       "card",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000011"), "Electricity Bill — April",      "Utilities",  3200m,   "2026-04-20", "Finance Team",       "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000012"), "Office Rent — May 2026",        "Rent",       15000m,  "2026-05-01", "Finance Team",       "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000013"), "Conference Registration Fees",  "Training",   5500m,   "2026-05-08", "Khalid Al-Mansoori", "card",          "pending"),
            (new Guid("b2000002-0000-0000-0000-000000000014"), "Stationery & Printing",         "Office",     980m,    "2026-05-10", "Samira Hamed",       "cash",          "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000015"), "Legal Retainer Fee — May",      "Legal",      8000m,   "2026-05-12", "Hassan Younis",      "bank_transfer", "pending"),
            (new Guid("b2000002-0000-0000-0000-000000000016"), "Telephone & Internet — May",    "Utilities",  2800m,   "2026-05-15", "Finance Team",       "bank_transfer", "approved"),
            (new Guid("b2000002-0000-0000-0000-000000000017"), "Staff Medical Insurance Top-up","Insurance",  9500m,   "2026-05-18", "Finance Team",       "bank_transfer", "pending"),
            (new Guid("b2000002-0000-0000-0000-000000000018"), "Client Entertaining — Q2",      "Marketing",  3200m,   "2026-05-20", "Omar Abdullah",      "cash",          "approved"),
        };

        foreach (var (id, title, category, amount, date, paidBy, method, status) in expenses)
        {
            if (existing.Contains(id)) continue;
            var exp = new Expense(title, category, amount, date, paidBy, method, null, null);
            SetId(exp, id);
            if (status == "approved") exp.Approve(FinanceManagerId);
            db.Expenses.Add(exp);
        }
    }

    // ── Invoices ──────────────────────────────────────────────────────────────

    private static async Task SeedInvoicesAsync(FinanceDbContext db)
    {
        var existing = await db.Invoices.IgnoreQueryFilters()
            .Select(i => i.Id).ToHashSetAsync();

        // (id, customer, email, date, dueDate, status, taxRate, [(desc, qty, price)])
        var invoices = new[]
        {
            (new Guid("b3000003-0000-0000-0000-000000000001"), "Emirates NBD",              "accounts@emiratesnbd.com",  "2026-03-05", "2026-04-05", "paid",
             new[] { ("ERP HR Module — Enterprise License", 1m, 65000m), ("Implementation & Setup", 1m, 15000m) }),
            (new Guid("b3000003-0000-0000-0000-000000000002"), "Abu Dhabi Commercial Bank", "finance@adcb.com",          "2026-03-15", "2026-04-15", "paid",
             new[] { ("POS System License (10 terminals)", 10m, 4500m), ("Annual Support Plan", 1m, 12000m) }),
            (new Guid("b3000003-0000-0000-0000-000000000003"), "Majid Al Futtaim",          "it@maf.ae",                 "2026-04-01", "2026-05-01", "paid",
             new[] { ("Inventory Management Module", 1m, 48000m), ("Training (5 days)", 5m, 2000m) }),
            (new Guid("b3000003-0000-0000-0000-000000000004"), "DEWA",                      "procurement@dewa.gov.ae",   "2026-04-10", "2026-05-10", "overdue",
             new[] { ("Finance & Accounting Module", 1m, 42000m) }),
            (new Guid("b3000003-0000-0000-0000-000000000005"), "Etisalat",                  "enterprise@etisalat.ae",    "2026-04-20", "2026-05-20", "sent",
             new[] { ("CRM Module License", 1m, 38000m), ("API Integration Package", 1m, 8500m) }),
            (new Guid("b3000003-0000-0000-0000-000000000006"), "Dubai Properties",          "billing@dubaiproperties.ae","2026-05-01", "2026-06-01", "sent",
             new[] { ("Real Estate Management Module", 1m, 55000m), ("Customization & Branding", 1m, 12000m) }),
            (new Guid("b3000003-0000-0000-0000-000000000007"), "Carrefour UAE",              "it@carrefour.ae",           "2026-05-10", "2026-06-10", "draft",
             new[] { ("Retail POS (50 terminals)", 50m, 3200m), ("Setup & Configuration", 1m, 18000m) }),
            (new Guid("b3000003-0000-0000-0000-000000000008"), "ADNOC",                     "erp@adnoc.ae",              "2026-05-15", "2026-06-15", "draft",
             new[] { ("Purchase & Vendor Module", 1m, 35000m), ("ERP Integration", 1m, 14000m) }),
        };

        var itemCounter = 1;
        foreach (var (id, customer, email, date, dueDate, status, items) in invoices)
        {
            if (existing.Contains(id)) continue;

            // Correct constructor: (customerName, customerEmail, invoiceDate, dueDate, taxRate, notes)
            var inv = new Invoice(customer, email, date, dueDate, 5m, null);
            SetId(inv, id);

            foreach (var (desc, qty, price) in items)
            {
                var itemId = new Guid($"b4{itemCounter++:000000}-0000-0000-0000-000000000001");
                // Correct constructor: (invoiceId, description, quantity, unitPrice)
                var item = new InvoiceItem(id, desc, qty, price);
                SetId(item, itemId);
                db.InvoiceItems.Add(item);
            }

            // Transition status — Invoice only has MarkPaid() and Cancel()
            // For "sent" and "overdue" we update the Status property via Update()
            if (status == "sent")
                inv.Update(customer, email, date, dueDate, 5m, null, "sent");
            else if (status == "overdue")
                inv.Update(customer, email, date, dueDate, 5m, null, "overdue");
            else if (status == "paid")
                inv.MarkPaid();

            db.Invoices.Add(inv);
        }
    }

    // ── Budgets ───────────────────────────────────────────────────────────────

    private static async Task SeedBudgetsAsync(FinanceDbContext db)
    {
        var existing = await db.Budgets.IgnoreQueryFilters()
            .Select(b => b.Id).ToHashSetAsync();

        var q1BudgetId = new Guid("b5000005-0000-0000-0000-000000000001");
        var q2BudgetId = new Guid("b5000005-0000-0000-0000-000000000002");
        var annualId   = new Guid("b5000005-0000-0000-0000-000000000003");

        var budgets = new[]
        {
            (q1BudgetId, "Q1 2026 Operating Budget", "2026-Q1", new[]
            {
                ("Salaries & Wages",        630000m, 645000m),
                ("Rent & Facilities",        45000m,  45000m),
                ("IT & Software",            25000m,  28000m),
                ("Marketing & Advertising",  60000m,  58000m),
                ("Travel & Accommodation",   15000m,  18000m),
                ("Utilities",                10000m,   9200m),
                ("Miscellaneous",             8000m,   7500m),
            }),
            (q2BudgetId, "Q2 2026 Operating Budget", "2026-Q2", new[]
            {
                ("Salaries & Wages",        630000m, 420000m),   // 2 months actual
                ("Rent & Facilities",        45000m,  30000m),
                ("IT & Software",            30000m,  21500m),
                ("Marketing & Advertising",  75000m,  48000m),
                ("Travel & Accommodation",   20000m,  12500m),
                ("Utilities",                10000m,   6200m),
                ("Miscellaneous",             8000m,   4200m),
            }),
            (annualId, "FY 2026 Annual Budget", "2026", new[]
            {
                ("Salaries & Wages",       2520000m, 1065000m),
                ("Rent & Facilities",       180000m,   75000m),
                ("IT & Software",           110000m,   49500m),
                ("Marketing & Advertising", 280000m,  106000m),
                ("Travel & Accommodation",   80000m,   30500m),
                ("Utilities",                42000m,   15400m),
                ("Miscellaneous",            32000m,   11700m),
            }),
        };

        var lineCounter = 1;
        foreach (var (budgetId, name, period, lines) in budgets)
        {
            if (existing.Contains(budgetId)) continue;

            var budget = new Budget(name, period, null);
            SetId(budget, budgetId);
            db.Budgets.Add(budget);
            await db.SaveChangesAsync();   // flush so BudgetId FK exists

            foreach (var (category, budgeted, actual) in lines)
            {
                var lineId = new Guid($"b6{lineCounter++:000000}-0000-0000-0000-000000000001");
                // Correct constructor: (budgetId, category, accountName?, budgetedAmount)
                var line = new BudgetLine(budgetId, category, null, budgeted);
                line.UpdateActual(actual);   // separate call — no actual param in ctor
                SetId(line, lineId);
                db.BudgetLines.Add(line);
            }
        }
    }

    // ── Journal entries (posted) ────────────────────────────────────────────────
    // Posted, balanced entries so the financial statements show real demo numbers.

    private static async Task SeedJournalsAsync(FinanceDbContext db)
    {
        var existing = await db.JournalEntries.IgnoreQueryFilters()
            .Select(j => j.Id).ToHashSetAsync();

        // (entryId, date, description, [ (accountId, accountName, debit, credit) ])
        var entries = new (Guid id, string date, string desc, (Guid acc, string name, decimal dr, decimal cr)[] lines)[]
        {
            (new Guid("b7000007-0000-0000-0000-000000000001"), "2026-03-31", "Q1 product sales",
                new[] { (AccBankMain, "Bank — Main Account", 250000m, 0m), (AccRevenueSales, "Sales Revenue", 0m, 250000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000002"), "2026-04-30", "Q2 services rendered",
                new[] { (AccBankMain, "Bank — Main Account", 180000m, 0m), (AccRevenueServices, "Service Revenue", 0m, 180000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000003"), "2026-05-31", "May sales on account",
                new[] { (AccAccountsRec, "Accounts Receivable", 120000m, 0m), (AccRevenueSales, "Sales Revenue", 0m, 120000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000004"), "2026-03-31", "Cost of goods sold — Q1",
                new[] { (AccCOGS, "Cost of Goods Sold", 140000m, 0m), (AccInventory, "Inventory", 0m, 140000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000005"), "2026-04-30", "April payroll",
                new[] { (AccSalaryExp, "Salaries & Wages", 210000m, 0m), (AccBankMain, "Bank — Main Account", 0m, 210000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000006"), "2026-05-01", "May rent",
                new[] { (AccRentExp, "Rent Expense", 45000m, 0m), (AccBankMain, "Bank — Main Account", 0m, 45000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000007"), "2026-05-15", "May marketing campaign",
                new[] { (AccMarketingExp, "Marketing & Advertising", 30000m, 0m), (AccBankMain, "Bank — Main Account", 0m, 30000m) }),
            (new Guid("b7000007-0000-0000-0000-000000000008"), "2026-05-20", "May utilities",
                new[] { (AccUtilitiesExp, "Utilities", 9000m, 0m), (AccCash, "Cash on Hand", 0m, 9000m) }),
        };

        foreach (var (id, date, desc, lines) in entries)
        {
            if (existing.Contains(id)) continue;
            var entry = new JournalEntry(date, desc, "SEED", null);
            SetId(entry, id);
            foreach (var (acc, name, dr, cr) in lines)
                entry.Lines.Add(new JournalEntryLine(entry.Id, acc, name, dr, cr, null));
            entry.Post();   // balanced → posted, so it feeds the statements
            db.JournalEntries.Add(entry);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void SetId(object entity, Guid id) =>
        entity.GetType().GetProperty("Id")!.SetValue(entity, id);

    private static void SetProp(object entity, string propName, object? value) =>
        entity.GetType().GetProperty(propName)!.SetValue(entity, value);
}
