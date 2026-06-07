using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Persistence.Seed;

public static class FinanceBankingTaxSeed
{
    private static readonly Guid BankMain    = new("c1000001-0000-0000-0000-000000000001");
    private static readonly Guid BankSavings = new("c1000001-0000-0000-0000-000000000002");
    private static readonly Guid BankPetty   = new("c1000001-0000-0000-0000-000000000003");

    public static async Task SeedAsync(FinanceDbContext db)
    {
        await SeedBankAccountsAsync(db);
        await SeedTaxPeriodsAsync(db);
        await db.SaveChangesAsync();
    }

    private static async Task SeedBankAccountsAsync(FinanceDbContext db)
    {
        var existing = await db.BankAccounts.IgnoreQueryFilters()
            .Select(x => x.Id).ToHashSetAsync();

        var accounts = new[]
        {
            (BankMain,    "Main Operating Account", "Emirates NBD", "0123456789", "AE070331234567890123456", "AED", 1_850_000m, 1_780_000m, "current"),
            (BankSavings, "Savings Reserve",        "ADCB",         "9876543210", "AE210030001122334455667", "AED",   500_000m,   500_000m, "savings"),
            (BankPetty,   "Petty Cash Account",     "FAB",          "5544332211", "AE460090004112233445566", "AED",    50_000m,    48_500m, "current"),
        };

        foreach (var (id, name, bank, num, iban, cur, bal, avail, type) in accounts)
        {
            if (existing.Contains(id)) continue;
            var acc = new BankAccount(name, bank, num, iban, cur, type);
            SetId(acc, id);
            acc.UpdateBalance(bal, avail);
            db.BankAccounts.Add(acc);
        }
        await db.SaveChangesAsync();

        // Seed transactions
        var txExisting = await db.BankTransactions.Select(x => x.AccountId).ToHashSetAsync();
        if (!txExisting.Contains(BankMain))
        {
            var txns = new[]
            {
                (BankMain, "2026-05-20", "Client Payment — Emirates NBD",  "REF-EMB-001", 65_000m,   "credit", "Revenue"),
                (BankMain, "2026-05-18", "Vendor Payment — Al Futtaim",    "REF-ALF-002", 28_500m,   "debit",  "Procurement"),
                (BankMain, "2026-05-15", "Office Rent — May",               "REF-RENT-05", 15_000m,   "debit",  "Facilities"),
                (BankMain, "2026-05-10", "Client Payment — ADCB",           "REF-ADC-003", 48_000m,   "credit", "Revenue"),
                (BankMain, "2026-05-05", "Payroll Transfer",                 "REF-PAY-05",  210_000m,  "debit",  "Payroll"),
                (BankMain, "2026-04-30", "Client Payment — MAF",             "REF-MAF-004", 50_000m,   "credit", "Revenue"),
            };

            var counter = 1;
            foreach (var (accId, date, desc, ref_, amt, type, cat) in txns)
            {
                var tx = new BankTransaction(accId, date, desc, ref_, amt, type, cat);
                SetId(tx, new Guid($"c2{counter++:000000}-0000-0000-0000-000000000001"));
                db.BankTransactions.Add(tx);
            }
        }
    }

    private static async Task SeedTaxPeriodsAsync(FinanceDbContext db)
    {
        var existing = await db.TaxPeriods.Select(x => x.Id).ToHashSetAsync();

        var periods = new[]
        {
            (new Guid("d1000001-0000-0000-0000-000000000001"), "Q1-2026", "2026-01-01", "2026-03-31", "2026-04-28", "paid",  142_500m, 68_200m,  "2026-04-15", "2026-04-28"),
            (new Guid("d1000001-0000-0000-0000-000000000002"), "Q2-2026", "2026-04-01", "2026-06-30", "2026-07-28", "open",   98_750m, 45_100m,  null,          null),
        };

        foreach (var (id, period, from, to, due, status, output, input, filed, paid) in periods)
        {
            if (existing.Contains(id)) continue;
            var tp = new TaxPeriod(period, from, to, due);
            SetId(tp, id);
            tp.UpdateAmounts(output, input);
            if (status == "filed" || status == "paid") tp.File(filed!);
            if (status == "paid") tp.MarkPaid(paid!);
            db.TaxPeriods.Add(tp);
        }
        await db.SaveChangesAsync();

        // Seed tax transactions for Q1
        var q1Id   = new Guid("d1000001-0000-0000-0000-000000000001");
        var txExist = await db.TaxTransactions.Select(x => x.PeriodId).ToHashSetAsync();
        if (!txExist.Contains(q1Id))
        {
            var txns = new[]
            {
                ("2026-01-15", "sale",     "INV-20260115-A1B2", 65_000m, 3_250m, 5m, "Emirates NBD Invoice"),
                ("2026-01-25", "sale",     "INV-20260125-C3D4", 48_000m, 2_400m, 5m, "ADCB Invoice"),
                ("2026-02-05", "purchase", "PO-20260205-001",   28_500m, 1_425m, 5m, "Al Futtaim Purchase"),
                ("2026-02-20", "sale",     "INV-20260220-E5F6", 50_000m, 2_500m, 5m, "MAF Invoice"),
                ("2026-03-10", "sale",     "INV-20260310-G7H8", 80_000m, 4_000m, 5m, "Enterprise Deal"),
            };
            var counter = 1;
            foreach (var (date, type, ref_, amt, vat, rate, desc) in txns)
            {
                var tx = new TaxTransaction(q1Id, date, type, ref_, amt, vat, rate, desc);
                SetId(tx, new Guid($"d2{counter++:000000}-0000-0000-0000-000000000001"));
                db.TaxTransactions.Add(tx);
            }
        }
    }

    private static void SetId(object entity, Guid id) =>
        entity.GetType().GetProperty("Id")!.SetValue(entity, id);
}
