using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

/// <summary>
/// Derives the VAT position from the documents that actually generate it — sales invoices for
/// output VAT, purchase bills for input VAT.
///
/// <para><b>Why derive instead of read a table.</b> The Tax screens used to read
/// <c>tax_transactions</c>, a table written <b>only by the demo seed</b> — no invoice, bill or
/// expense has ever created a row in it. Likewise <c>TaxPeriod.OutputVat</c>/<c>InputVat</c> are
/// stored fields that nothing in the request path populates. The result was a Tax &amp; VAT page
/// that showed nothing for every real tenant, even with VAT correctly sitting in the ledger.
/// Deriving keeps the figures in step with the source documents automatically and cannot drift,
/// the same approach the GL reports take with journal lines.</para>
///
/// <para><b>Scope.</b> Draft and cancelled documents are excluded — a draft invoice has not been
/// issued, so its VAT is not yet a liability. <c>Expense</c> carries no tax fields at all, so it
/// contributes no input VAT; only purchase bills do.</para>
/// </summary>
internal static class VatLedger
{
    /// <summary>Invoice statuses whose VAT counts as output VAT (i.e. the invoice has been issued).</summary>
    private static readonly string[] IssuedInvoiceStatuses = ["sent", "partially_paid", "paid", "overdue"];

    /// <summary>Bill statuses whose VAT is reclaimable input VAT (i.e. the bill has been approved).</summary>
    private static readonly string[] ApprovedBillStatuses = ["approved", "partially_paid", "paid"];

    /// <summary>
    /// Every VAT-bearing transaction, newest first. <c>Period</c> is resolved against the tenant's
    /// declared tax periods where one covers the date, otherwise it falls back to the calendar
    /// month so the row is still groupable.
    /// </summary>
    /// <param name="period">
    /// Restricts the build to one declared tax period. A VAT screen is always read one period at a
    /// time, and this is what keeps the query bounded: without it every invoice and bill the tenant
    /// has ever issued is read on each call. Narrowed in SQL via the period's date range, so the
    /// unmatched documents are never fetched. An unknown period yields no rows.
    /// </param>
    public static async Task<List<TaxTransactionDto>> BuildAsync(
        FinanceDbContext db, CancellationToken ct, string? period = null)
    {
        var periods = await db.TaxPeriods.AsNoTracking()
            .Select(p => new { p.Period, p.FromDate, p.ToDate })
            .ToListAsync(ct);

        string? from = null, to = null;
        if (!string.IsNullOrWhiteSpace(period))
        {
            var declared = periods.FirstOrDefault(p => p.Period == period);
            if (declared is not null) { from = declared.FromDate; to = declared.ToDate; }
            // Not a declared period: fall back to the yyyy-MM the PeriodFor() default produces,
            // otherwise a month-labelled row would be unreachable through its own filter.
            else if (period!.Length == 7) { from = period + "-01"; to = period + "-32"; }
            else return [];
        }

        // SubTotal/TaxAmount are computed properties, so the line sum is projected in SQL rather
        // than materialising every invoice with its items.
        var sales = await db.Invoices.AsNoTracking()
            .Where(i => !i.IsDeleted && IssuedInvoiceStatuses.Contains(i.Status))
            .Where(i => from == null || (string.Compare(i.InvoiceDate, from) >= 0 && string.Compare(i.InvoiceDate, to) <= 0))
            .Select(i => new
            {
                i.Id, i.InvoiceDate, i.InvoiceNumber, i.CustomerName, i.TaxRate,
                SubTotal = i.Items.Sum(x => x.Quantity * x.UnitPrice),
                // Only standard-rated lines carry VAT; zero-rated / exempt / out-of-scope lines do not.
                Taxable  = i.Items.Where(x => x.TaxCategory == null || x.TaxCategory == "S").Sum(x => x.Quantity * x.UnitPrice),
            })
            .ToListAsync(ct);

        var purchases = await db.PurchaseBills.AsNoTracking()
            .Where(b => !b.IsDeleted && ApprovedBillStatuses.Contains(b.Status))
            .Where(b => from == null || (string.Compare(b.BillDate, from) >= 0 && string.Compare(b.BillDate, to) <= 0))
            .Select(b => new
            {
                b.Id, b.BillDate, b.BillNumber, b.SupplierName, b.TaxRate,
                SubTotal = b.Items.Sum(x => x.Quantity * x.UnitPrice),
            })
            .ToListAsync(ct);

        string PeriodFor(string date)
        {
            var match = periods.FirstOrDefault(p =>
                string.CompareOrdinal(date, p.FromDate) >= 0 && string.CompareOrdinal(date, p.ToDate) <= 0);
            if (match is not null) return match.Period;
            return date.Length >= 7 ? date[..7] : date;   // yyyy-MM fallback
        }

        var rows = new List<TaxTransactionDto>(sales.Count + purchases.Count);

        rows.AddRange(sales.Select(s => new TaxTransactionDto(
            s.Id, s.InvoiceDate, "sale", s.InvoiceNumber,
            s.SubTotal, Math.Round(s.Taxable * s.TaxRate / 100m, 2), s.TaxRate,
            s.CustomerName, PeriodFor(s.InvoiceDate))));

        rows.AddRange(purchases.Select(p => new TaxTransactionDto(
            p.Id, p.BillDate, "purchase", p.BillNumber,
            p.SubTotal, Math.Round(p.SubTotal * p.TaxRate / 100m, 2), p.TaxRate,
            p.SupplierName, PeriodFor(p.BillDate))));

        return rows.OrderByDescending(r => r.Date).ToList();
    }

    /// <summary>
    /// The same documents, statuses and VAT arithmetic as <see cref="BuildAsync"/>, enriched with
    /// what the FTA return and audit file need: counterparty TRN, document currency, and AED
    /// values. AED conversion uses <see cref="GeneralLedger.GlPoster.GetRateAsync"/> — the rate the
    /// GL posted with — so the return reconciles to the VAT control account instead of drifting
    /// against it. VAT itself is never recomputed here.
    /// </summary>
    public static async Task<List<Softaxis.Finance.Application.UaeVat.VatSourceLine>> BuildSourceLinesAsync(
        FinanceDbContext db, string fromDate, string toDate, CancellationToken ct)
    {
        var sales = await db.Invoices.AsNoTracking()
            .Where(i => !i.IsDeleted && IssuedInvoiceStatuses.Contains(i.Status))
            .Where(i => string.Compare(i.InvoiceDate, fromDate) >= 0 && string.Compare(i.InvoiceDate, toDate) <= 0)
            .Select(i => new
            {
                i.InvoiceDate, i.InvoiceNumber, i.CustomerName, i.CustomerTrn, i.TaxRate, i.CurrencyCode,
                Std    = i.Items.Where(x => x.TaxCategory == null || x.TaxCategory == "S").Sum(x => x.Quantity * x.UnitPrice),
                Zero   = i.Items.Where(x => x.TaxCategory == "Z").Sum(x => x.Quantity * x.UnitPrice),
                Exempt = i.Items.Where(x => x.TaxCategory == "E").Sum(x => x.Quantity * x.UnitPrice),
                Out    = i.Items.Where(x => x.TaxCategory == "O").Sum(x => x.Quantity * x.UnitPrice),
            })
            .ToListAsync(ct);

        var purchases = await (
            from b in db.PurchaseBills.AsNoTracking()
            where !b.IsDeleted && ApprovedBillStatuses.Contains(b.Status)
               && string.Compare(b.BillDate, fromDate) >= 0 && string.Compare(b.BillDate, toDate) <= 0
            join s in db.Suppliers.AsNoTracking() on b.SupplierId equals s.Id into sj
            from s in sj.DefaultIfEmpty()
            select new
            {
                b.BillDate, b.BillNumber, b.SupplierName, SupplierTrn = s != null ? s.TaxNumber : null,
                b.TaxRate, b.CurrencyCode,
                SubTotal = b.Items.Sum(x => x.Quantity * x.UnitPrice),
            })
            .ToListAsync(ct);

        var knownRateCodes = (await db.ExchangeRates.AsNoTracking()
                .Select(r => r.CurrencyCode).Distinct().ToListAsync(ct))
            .Select(c => c.ToUpperInvariant()).ToHashSet();

        var rateCache = new Dictionary<(string, string), decimal>();
        async Task<decimal> RateAsync(string currency, string date)
        {
            var key = (currency, date);
            if (!rateCache.TryGetValue(key, out var r))
                rateCache[key] = r = await GeneralLedger.GlPoster.GetRateAsync(db, currency, date, ct);
            return r;
        }

        var lines = new List<Softaxis.Finance.Application.UaeVat.VatSourceLine>(sales.Count + purchases.Count);

        foreach (var s in sales)
        {
            var cur = (s.CurrencyCode ?? "AED").Trim().ToUpperInvariant();
            var rate = await RateAsync(cur, s.InvoiceDate);
            var missingFx = cur != "AED" && !knownRateCodes.Contains(cur);
            // One source line per VAT category on the invoice, so a mixed invoice lands in the right boxes.
            // The standard part keeps today's semantics (category null), so all-standard invoices read as before.
            var std = s.Std;
            var anyCategorised = s.Zero != 0 || s.Exempt != 0 || s.Out != 0;
            if (std != 0 || !anyCategorised)
            {
                var vat = Math.Round(std * s.TaxRate / 100m, 2);
                lines.Add(new("sale", s.InvoiceDate, s.InvoiceNumber, s.CustomerName, s.CustomerTrn, s.TaxRate, cur,
                    std, vat, Math.Round(std * rate, 2), Math.Round(vat * rate, 2), missingFx));
            }
            foreach (var (cat, net) in new[] { ("Z", s.Zero), ("E", s.Exempt), ("O", s.Out) })
                if (net != 0)
                    lines.Add(new("sale", s.InvoiceDate, s.InvoiceNumber, s.CustomerName, s.CustomerTrn, 0m, cur,
                        net, 0m, Math.Round(net * rate, 2), 0m, missingFx, cat));
        }

        foreach (var p in purchases)
        {
            var cur = (p.CurrencyCode ?? "AED").Trim().ToUpperInvariant();
            var vat = Math.Round(p.SubTotal * p.TaxRate / 100m, 2);
            var rate = await RateAsync(cur, p.BillDate);
            lines.Add(new(
                "purchase", p.BillDate, p.BillNumber, p.SupplierName, p.SupplierTrn, p.TaxRate, cur,
                p.SubTotal, vat, Math.Round(p.SubTotal * rate, 2), Math.Round(vat * rate, 2),
                cur != "AED" && !knownRateCodes.Contains(cur)));
        }

        return lines;
    }

    /// <summary>
    /// Net movement (credits − debits) on the VAT control account for posted journals dated in the
    /// period, or null when nothing touched it — the GL side of the return's reconciliation.
    /// </summary>
    public static async Task<decimal?> GlNetVatAsync(FinanceDbContext db, string fromDate, string toDate, CancellationToken ct)
    {
        var rows = await (
            from l in db.JournalLines.AsNoTracking()
            join e in db.JournalEntries.AsNoTracking() on l.JournalEntryId equals e.Id
            join a in db.Accounts.AsNoTracking() on l.AccountId equals a.Id
            where !e.IsDeleted && e.Status == "posted"
               && a.AccountNumber == GeneralLedger.GlPoster.VatPayable
               && string.Compare(e.Date, fromDate) >= 0 && string.Compare(e.Date, toDate) <= 0
            select new { l.DebitAmount, l.CreditAmount })
            .ToListAsync(ct);

        return rows.Count == 0 ? null : Math.Round(rows.Sum(r => r.CreditAmount - r.DebitAmount), 2);
    }

    /// <summary>Output / input / net VAT for the given rows.</summary>
    public static (decimal Output, decimal Input, decimal Net) Totals(IEnumerable<TaxTransactionDto> rows)
    {
        var output = rows.Where(r => r.Type == "sale").Sum(r => r.VatAmount);
        var input  = rows.Where(r => r.Type == "purchase").Sum(r => r.VatAmount);
        return (output, input, output - input);
    }
}
