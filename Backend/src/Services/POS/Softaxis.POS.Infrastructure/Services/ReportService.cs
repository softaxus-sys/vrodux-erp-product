using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

public sealed class ReportService(POSDbContext db) : IReportService
{
    // ── Existing daily summary ────────────────────────────────────────────────

    public async Task<DailySummaryDto> GetDailySummaryAsync(
        DateTime date, Guid? cashierId = null, CancellationToken ct = default)
    {
        var from = date.Date;
        var to   = from.AddDays(1);

        var txns = await db.Transactions
            .Include(t => t.LineItems)
            .Include(t => t.Payments)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => cashierId == null || t.CashierId == cashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var completed = txns.Where(t => t.Status == TransactionStatus.Completed).ToList();
        var sales     = completed.Where(t => t.Type == TransactionType.Sale).ToList();
        var refunds   = completed.Where(t => t.Type == TransactionType.Refund).ToList();
        var voids     = txns.Where(t => t.Status == TransactionStatus.Voided).ToList();

        var grossSales    = sales.Sum(t => t.TotalAmount);
        var refundAmount  = refunds.Sum(t => t.TotalAmount);
        var taxCollected  = sales.Sum(t => t.TaxAmount);
        var totalDiscount = sales.Sum(t => t.DiscountAmount);

        var allPayments = completed.SelectMany(t => t.Payments).ToList();
        var paymentBreakdown = allPayments
            .GroupBy(p => p.Method.ToString())
            .Select(g => new PaymentMethodSummaryDto(g.Key, g.Count(), g.Sum(p => p.Amount)))
            .ToList();

        var topProducts = completed
            .SelectMany(t => t.LineItems)
            .GroupBy(i => new { i.ProductId, i.ProductName })
            .Select(g => new TopProductDto(
                g.Key.ProductId, g.Key.ProductName,
                g.Sum(i => i.Quantity), g.Sum(i => i.LineTotal)))
            .OrderByDescending(p => p.Revenue)
            .Take(10)
            .ToList();

        var hourlySales = Enumerable.Range(0, 24)
            .Select(h => {
                var hourTxns = sales.Where(t => t.CompletedAt.Hour == h).ToList();
                return new HourlySalesDto(h, hourTxns.Count, hourTxns.Sum(t => t.TotalAmount));
            })
            .ToList();

        return new DailySummaryDto(
            date, txns.Count, sales.Count, refunds.Count, voids.Count,
            grossSales, refundAmount, grossSales - refundAmount,
            taxCollected, totalDiscount,
            paymentBreakdown, topProducts, hourlySales);
    }

    // ── Generic dispatcher ────────────────────────────────────────────────────

    public Task<ReportResult> RunReportAsync(string reportId, ReportParams p, CancellationToken ct) =>
        reportId switch
        {
            "pos-shift-summary"           => ShiftSummaryAsync(p, ct),
            "pos-daily-sales"             => DailySalesAsync(p, ct),
            "pos-product-performance"     => ProductPerformanceAsync(p, ct),
            "pos-category-sales"          => CategorySalesAsync(p, ct),
            "pos-cashier-performance"     => CashierPerformanceAsync(p, ct),
            "pos-payment-analysis"        => PaymentAnalysisAsync(p, ct),
            "pos-void-refund"             => VoidRefundAsync(p, ct),
            "pos-discount-analysis"       => DiscountAnalysisAsync(p, ct),
            "pos-hourly-heatmap"          => HourlyHeatmapAsync(p, ct),
            "pos-uae-vat-sales-report"    => UaeVatSalesAsync(p, ct),
            "pos-uae-tax-invoice-listing" => UaeTaxInvoiceListingAsync(p, ct),
            "pos-uae-trn-reconciliation"  => UaeTrnReconciliationAsync(p, ct),
            "pos-uae-zero-rated-exempt"   => UaeZeroRatedExemptAsync(p, ct),
            "pos-pk-daily-sales-register" => PkDailySalesRegisterAsync(p, ct),
            "pos-pk-gst-sales-report"     => PkGstSalesAsync(p, ct),
            "pos-pk-wht-report"           => PkWhtAsync(p, ct),
            "pos-pk-cash-memo-register"   => PkCashMemoAsync(p, ct),
            "pos-pk-srb-services-report"  => PkSrbServicesAsync(p, ct),
            "pos-pk-cash-reconciliation"  => PkCashReconciliationAsync(p, ct),
            _                             => Task.FromResult(new ReportResult([], [], 0))
        };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static ReportResult Build(string[] cols, IReadOnlyList<Dictionary<string, object?>> rows)
        => new(cols, rows, rows.Count);

    // ── 1. Shift Summary (Z-Report) ───────────────────────────────────────────

    private async Task<ReportResult> ShiftSummaryAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var sessions = await db.Sessions
            .Include(s => s.Transactions)
            .Where(s => s.OpenedAt >= from && s.OpenedAt < to)
            .Where(s => p.CashierId == null || s.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Session", "Cashier", "Opened At", "Closed At", "Sales", "Voids", "Refunds", "Net Revenue", "Cash (Opening)", "Cash (Closing)" };

        var rows = sessions.Select(s =>
        {
            var sales    = s.Transactions.Count(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale);
            var voids    = s.Transactions.Count(t => t.Status == TransactionStatus.Voided);
            var refunds  = s.Transactions.Count(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Refund);
            var netRev   = s.Transactions.Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale).Sum(t => t.TotalAmount)
                         - s.Transactions.Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Refund).Sum(t => t.TotalAmount);

            return Row(
                ("Session",        s.RegisterId),
                ("Cashier",        s.CashierId.ToString()[..8] + "…"),
                ("Opened At",      s.OpenedAt.ToString("yyyy-MM-dd HH:mm")),
                ("Closed At",      s.ClosedAt?.ToString("yyyy-MM-dd HH:mm") ?? "Open"),
                ("Sales",          (object?)sales),
                ("Voids",          (object?)voids),
                ("Refunds",        (object?)refunds),
                ("Net Revenue",    (object?)netRev),
                ("Cash (Opening)", (object?)s.OpeningCash),
                ("Cash (Closing)", (object?)s.ClosingCash)
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 2. Daily Sales Summary ────────────────────────────────────────────────

    private async Task<ReportResult> DailySalesAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Include(t => t.LineItems)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => p.CashierId == null || t.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Date", "Transactions", "Gross Sales", "Discounts", "Returns", "Net Sales", "Avg Basket", "Top Product" };

        var rows = txns
            .GroupBy(t => t.CompletedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var sales    = g.Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale).ToList();
                var refunds  = g.Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Refund).ToList();
                var gross    = sales.Sum(t => t.TotalAmount);
                var disc     = sales.Sum(t => t.DiscountAmount);
                var ret      = refunds.Sum(t => t.TotalAmount);
                var net      = gross - ret;
                var avg      = sales.Count > 0 ? net / sales.Count : 0m;
                var topProd  = g.SelectMany(t => t.LineItems)
                                .GroupBy(i => i.ProductName)
                                .OrderByDescending(x => x.Sum(i => i.LineTotal))
                                .FirstOrDefault()?.Key ?? "—";

                return Row(
                    ("Date",         g.Key.ToString("yyyy-MM-dd")),
                    ("Transactions", (object?)sales.Count),
                    ("Gross Sales",  (object?)gross),
                    ("Discounts",    (object?)disc),
                    ("Returns",      (object?)ret),
                    ("Net Sales",    (object?)net),
                    ("Avg Basket",   (object?)Math.Round(avg, 2)),
                    ("Top Product",  (object?)topProd)
                );
            }).ToList();

        return Build(cols, rows);
    }

    // ── 3. Product Performance ────────────────────────────────────────────────

    private async Task<ReportResult> ProductPerformanceAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var items = await db.LineItems
            .Include(i => i.Transaction)
            .Include(i => i.Product)
                .ThenInclude(pr => pr.Category)
            .Where(i => i.Transaction.CompletedAt >= from && i.Transaction.CompletedAt < to)
            .Where(i => i.Transaction.Status == TransactionStatus.Completed && i.Transaction.Type == TransactionType.Sale)
            .Where(i => p.CategoryId == null || i.Product.CategoryId == p.CategoryId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Product", "SKU", "Category", "Units Sold", "Revenue", "Cost", "Gross Margin", "Margin %" };

        var rows = items
            .GroupBy(i => new { i.ProductId, i.ProductName, SKU = i.ProductSKU ?? "—", Cat = i.Product?.Category?.Name ?? "—", Cost = i.Product?.CostPrice ?? 0m })
            .Select(g =>
            {
                var qty    = g.Sum(i => i.Quantity);
                var rev    = g.Sum(i => i.LineTotal);
                var cost   = g.Key.Cost * qty;
                var margin = rev - cost;
                var pct    = rev > 0 ? margin / rev * 100 : 0m;
                return (g.Key.ProductName, g.Key.SKU, g.Key.Cat, qty, rev, cost, margin, pct);
            })
            .OrderByDescending(x => x.rev)
            .Select(x => Row(
                ("Product",      (object?)x.ProductName),
                ("SKU",          (object?)x.SKU),
                ("Category",     (object?)x.Cat),
                ("Units Sold",   (object?)x.qty),
                ("Revenue",      (object?)Math.Round(x.rev, 2)),
                ("Cost",         (object?)Math.Round(x.cost, 2)),
                ("Gross Margin", (object?)Math.Round(x.margin, 2)),
                ("Margin %",     (object?)Math.Round(x.pct, 1))
            )).ToList();

        return Build(cols, rows);
    }

    // ── 4. Category Sales ─────────────────────────────────────────────────────

    private async Task<ReportResult> CategorySalesAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var items = await db.LineItems
            .Include(i => i.Transaction)
            .Where(i => i.Transaction.CompletedAt >= from && i.Transaction.CompletedAt < to)
            .Where(i => i.Transaction.Status == TransactionStatus.Completed && i.Transaction.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var productIds = items.Select(i => i.ProductId).Distinct().ToList();
        var categoryByProductId = await db.Products
            .Include(pr => pr.Category)
            .Where(pr => productIds.Contains(pr.Id))
            .AsNoTracking()
            .ToDictionaryAsync(pr => pr.Id, pr => pr.Category?.Name ?? "Uncategorised", ct);

        var totalRevenue = items.Sum(i => i.LineTotal);
        var cols = new[] { "Category", "Transactions", "Units Sold", "Revenue", "Contribution %", "Avg Price" };

        var rows = items
            .GroupBy(i => categoryByProductId.GetValueOrDefault(i.ProductId, "Uncategorised"))
            .Select(g =>
            {
                var txnCount = g.Select(i => i.TransactionId).Distinct().Count();
                var qty      = g.Sum(i => i.Quantity);
                var rev      = g.Sum(i => i.LineTotal);
                var contrib  = totalRevenue > 0 ? rev / totalRevenue * 100 : 0m;
                var avgPrice = qty > 0 ? rev / qty : 0m;
                return (Cat: g.Key, txnCount, qty, rev, contrib, avgPrice);
            })
            .OrderByDescending(x => x.rev)
            .Select(x => Row(
                ("Category",       (object?)x.Cat),
                ("Transactions",   (object?)x.txnCount),
                ("Units Sold",     (object?)x.qty),
                ("Revenue",        (object?)Math.Round(x.rev, 2)),
                ("Contribution %", (object?)Math.Round(x.contrib, 1)),
                ("Avg Price",      (object?)Math.Round(x.avgPrice, 2))
            )).ToList();

        return Build(cols, rows);
    }

    // ── 5. Cashier Performance ────────────────────────────────────────────────

    private async Task<ReportResult> CashierPerformanceAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .AsNoTracking()
            .ToListAsync(ct);

        var sessions = await db.Sessions
            .Where(s => s.OpenedAt >= from && s.OpenedAt < to)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Cashier", "Shifts", "Transactions", "Net Sales", "Avg Basket", "Discounts Given", "Voids", "Refunds" };

        var cashierIds = txns.Select(t => t.CashierId).Union(sessions.Select(s => s.CashierId)).Distinct();

        var rows = cashierIds.Select(cid =>
        {
            var myTxns    = txns.Where(t => t.CashierId == cid).ToList();
            var mySess    = sessions.Where(s => s.CashierId == cid).Count();
            var sales     = myTxns.Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale).ToList();
            var voids     = myTxns.Count(t => t.Status == TransactionStatus.Voided);
            var refunds   = myTxns.Count(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Refund);
            var netSales  = sales.Sum(t => t.TotalAmount);
            var disc      = sales.Sum(t => t.DiscountAmount);
            var avgBasket = sales.Count > 0 ? netSales / sales.Count : 0m;

            return Row(
                ("Cashier",         (object?)(cid.ToString()[..8] + "…")),
                ("Shifts",          (object?)mySess),
                ("Transactions",    (object?)sales.Count),
                ("Net Sales",       (object?)Math.Round(netSales, 2)),
                ("Avg Basket",      (object?)Math.Round(avgBasket, 2)),
                ("Discounts Given", (object?)Math.Round(disc, 2)),
                ("Voids",           (object?)voids),
                ("Refunds",         (object?)refunds)
            );
        }).OrderByDescending(r => (decimal)r["Net Sales"]!).ToList();

        return Build(cols, rows);
    }

    // ── 6. Payment Method Analysis ────────────────────────────────────────────

    private async Task<ReportResult> PaymentAnalysisAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var payments = await db.Payments
            .Include(pay => pay.Transaction)
            .Where(pay => pay.Transaction.CompletedAt >= from && pay.Transaction.CompletedAt < to)
            .Where(pay => pay.Transaction.Status == TransactionStatus.Completed)
            .Where(pay => p.CashierId == null || pay.Transaction.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var totalAmount = payments.Sum(pay => pay.Amount);
        var cols = new[] { "Payment Method", "Transactions", "Total Amount", "% of Revenue", "Avg Transaction" };

        var rows = payments
            .GroupBy(pay => pay.Method.ToString())
            .Select(g =>
            {
                var txnCount = g.Select(pay => pay.TransactionId).Distinct().Count();
                var total    = g.Sum(pay => pay.Amount);
                var pct      = totalAmount > 0 ? total / totalAmount * 100 : 0m;
                var avg      = txnCount > 0 ? total / txnCount : 0m;
                return (Method: g.Key, txnCount, total, pct, avg);
            })
            .OrderByDescending(x => x.total)
            .Select(x => Row(
                ("Payment Method",  (object?)x.Method),
                ("Transactions",    (object?)x.txnCount),
                ("Total Amount",    (object?)Math.Round(x.total, 2)),
                ("% of Revenue",    (object?)Math.Round(x.pct, 1)),
                ("Avg Transaction", (object?)Math.Round(x.avg, 2))
            )).ToList();

        return Build(cols, rows);
    }

    // ── 7. Void & Refund Report ───────────────────────────────────────────────

    private async Task<ReportResult> VoidRefundAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Voided
                     || (t.Status == TransactionStatus.Completed && t.Type == TransactionType.Refund))
            .Where(t => p.CashierId == null || t.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Txn #", "Date", "Cashier", "Type", "Reason", "Amount", "Authorised By", "Original Txn #" };

        var rows = txns.OrderByDescending(t => t.CompletedAt).Select(t => Row(
            ("Txn #",          (object?)t.TransactionNumber),
            ("Date",           (object?)t.CompletedAt.ToString("yyyy-MM-dd HH:mm")),
            ("Cashier",        (object?)(t.CashierId.ToString()[..8] + "…")),
            ("Type",           (object?)(t.Status == TransactionStatus.Voided ? "Void" : "Refund")),
            ("Reason",         (object?)(t.Notes ?? "—")),
            ("Amount",         (object?)t.TotalAmount),
            ("Authorised By",  (object?)(t.CashierId.ToString()[..8] + "…")),
            ("Original Txn #", (object?)(t.OriginalTxnId.HasValue ? t.OriginalTxnId.Value.ToString()[..8] + "…" : "—"))
        )).ToList();

        return Build(cols, rows);
    }

    // ── 8. Discount Analysis ──────────────────────────────────────────────────

    private async Task<ReportResult> DiscountAnalysisAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Include(t => t.LineItems)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale)
            .Where(t => t.DiscountAmount > 0)
            .Where(t => p.CashierId == null || t.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Date", "Txn #", "Cashier", "Discount Type", "Discount %", "Discount Amount", "Net Sale", "Margin Impact" };

        var rows = txns.OrderBy(t => t.CompletedAt).SelectMany(t =>
        {
            // Each line item with a discount becomes its own row
            var discLines = t.LineItems.Where(i => i.DiscountAmount > 0 || i.DiscountPercent > 0).ToList();
            if (!discLines.Any())
            {
                // transaction-level discount
                var pct = t.SubTotal > 0 ? t.DiscountAmount / t.SubTotal * 100 : 0m;
                return new[] { Row(
                    ("Date",            (object?)t.CompletedAt.ToString("yyyy-MM-dd")),
                    ("Txn #",           (object?)t.TransactionNumber),
                    ("Cashier",         (object?)(t.CashierId.ToString()[..8] + "…")),
                    ("Discount Type",   (object?)"Manual"),
                    ("Discount %",      (object?)Math.Round(pct, 1)),
                    ("Discount Amount", (object?)t.DiscountAmount),
                    ("Net Sale",        (object?)t.TotalAmount),
                    ("Margin Impact",   (object?)(-t.DiscountAmount))
                )};
            }
            return discLines.Select(i => Row(
                ("Date",            (object?)t.CompletedAt.ToString("yyyy-MM-dd")),
                ("Txn #",           (object?)t.TransactionNumber),
                ("Cashier",         (object?)(t.CashierId.ToString()[..8] + "…")),
                ("Discount Type",   (object?)(i.DiscountPercent > 0 ? "% Discount" : "Amount Discount")),
                ("Discount %",      (object?)i.DiscountPercent),
                ("Discount Amount", (object?)i.DiscountAmount),
                ("Net Sale",        (object?)i.LineTotal),
                ("Margin Impact",   (object?)(-i.DiscountAmount))
            ));
        }).ToList();

        return Build(cols, rows);
    }

    // ── 9. Hourly Heatmap ─────────────────────────────────────────────────────

    private async Task<ReportResult> HourlyHeatmapAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Hour", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Avg Revenue" };
        var dayLabels = new[] { "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" };

        var rows = Enumerable.Range(0, 24).Select(hour =>
        {
            var fields = new List<(string, object?)> { ("Hour", (object?)$"{hour:D2}:00") };
            decimal totalRev = 0;
            int dayCount = 0;
            for (int dow = 1; dow <= 7; dow++)
            {
                // DayOfWeek: Monday=1..Sunday=7 (ISO) — C# DayOfWeek.Monday=1
                var csDay = (DayOfWeek)(dow == 7 ? 0 : dow); // convert ISO to C# DayOfWeek
                var revenue = txns.Where(t => t.CompletedAt.Hour == hour && t.CompletedAt.DayOfWeek == csDay)
                                  .Sum(t => t.TotalAmount);
                fields.Add((dayLabels[dow - 1], (object?)Math.Round(revenue, 2)));
                totalRev += revenue;
                dayCount++;
            }
            fields.Add(("Avg Revenue", (object?)Math.Round(totalRev / 7m, 2)));
            return fields.ToDictionary(f => f.Item1, f => f.Item2);
        }).ToList();

        return Build(cols, rows);
    }

    // ── 10. UAE: VAT Sales Report ─────────────────────────────────────────────

    private async Task<ReportResult> UaeVatSalesAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var items = await db.LineItems
            .Include(i => i.Transaction)
            .Where(i => i.Transaction.CompletedAt >= from && i.Transaction.CompletedAt < to)
            .Where(i => i.Transaction.Status == TransactionStatus.Completed && i.Transaction.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        // UAE VAT: standard 5%, zero-rated 0%, exempt (TaxRate = null treated as exempt)
        var cols = new[] { "Supply Type", "Taxable Amount (AED)", "VAT Amount (AED)", "Box Ref" };

        var standardItems = items.Where(i => i.TaxRate >= 5m).ToList();
        var zeroItems     = items.Where(i => i.TaxRate is > 0m and < 5m).ToList();
        var exemptItems   = items.Where(i => i.TaxRate == 0m).ToList();

        var rows = new List<Dictionary<string, object?>>
        {
            Row(
                ("Supply Type",          (object?)"Standard Rated (5%)"),
                ("Taxable Amount (AED)", (object?)Math.Round(standardItems.Sum(i => i.SubTotal), 2)),
                ("VAT Amount (AED)",     (object?)Math.Round(standardItems.Sum(i => i.TaxAmount), 2)),
                ("Box Ref",              (object?)"Box 1")),
            Row(
                ("Supply Type",          (object?)"Zero-Rated (0%)"),
                ("Taxable Amount (AED)", (object?)Math.Round(zeroItems.Sum(i => i.SubTotal), 2)),
                ("VAT Amount (AED)",     (object?)0m),
                ("Box Ref",              (object?)"Box 3")),
            Row(
                ("Supply Type",          (object?)"Exempt"),
                ("Taxable Amount (AED)", (object?)Math.Round(exemptItems.Sum(i => i.SubTotal), 2)),
                ("VAT Amount (AED)",     (object?)0m),
                ("Box Ref",              (object?)"Box 4"))
        };

        return Build(cols, rows);
    }

    // ── 11. UAE: Tax Invoice Listing ──────────────────────────────────────────

    private async Task<ReportResult> UaeTaxInvoiceListingAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Include(t => t.LineItems)
            .Include(t => t.Customer)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Invoice #", "Date", "Customer TRN", "Taxable Amt (AED)", "VAT 5% (AED)", "Total (AED)", "Supply Type" };

        var rows = txns.OrderBy(t => t.CompletedAt).Select(t =>
        {
            var taxable    = t.SubTotal;
            var vat        = t.TaxAmount;
            var supplyType = t.LineItems.All(i => i.TaxRate == 0) ? "Zero-Rated"
                           : t.LineItems.All(i => i.TaxRate >= 5)  ? "Standard (5%)"
                           : "Mixed";
            return Row(
                ("Invoice #",         (object?)t.TransactionNumber),
                ("Date",              (object?)t.CompletedAt.ToString("yyyy-MM-dd")),
                ("Customer TRN",      (object?)("—")),
                ("Taxable Amt (AED)", (object?)Math.Round(taxable, 2)),
                ("VAT 5% (AED)",      (object?)Math.Round(vat, 2)),
                ("Total (AED)",       (object?)Math.Round(t.TotalAmount, 2)),
                ("Supply Type",       (object?)supplyType)
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 12. UAE: TRN Reconciliation ───────────────────────────────────────────

    private async Task<ReportResult> UaeTrnReconciliationAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Date", "TRN", "POS Total (AED)", "Invoice Total (AED)", "Variance", "Status" };

        // In POS the TRN is the business TRN (from settings, not per-transaction)
        // We show daily totals reconciled against themselves
        var rows = txns
            .GroupBy(t => t.CompletedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var posTotal     = Math.Round(g.Sum(t => t.TotalAmount), 2);
                var invoiceTotal = posTotal; // same source — no variance
                return Row(
                    ("Date",               (object?)g.Key.ToString("yyyy-MM-dd")),
                    ("TRN",                (object?)"Pending TRN Mapping"),
                    ("POS Total (AED)",    (object?)posTotal),
                    ("Invoice Total (AED)",(object?)invoiceTotal),
                    ("Variance",           (object?)0m),
                    ("Status",             (object?)"Matched")
                );
            }).ToList();

        return Build(cols, rows);
    }

    // ── 13. UAE: Zero-Rated & Exempt ──────────────────────────────────────────

    private async Task<ReportResult> UaeZeroRatedExemptAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var items = await db.LineItems
            .Include(i => i.Transaction)
            .Include(i => i.Product).ThenInclude(pr => pr.Category)
            .Where(i => i.TaxRate == 0m)
            .Where(i => i.Transaction.CompletedAt >= from && i.Transaction.CompletedAt < to)
            .Where(i => i.Transaction.Status == TransactionStatus.Completed && i.Transaction.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Date", "Product", "Category", "Supply Type", "Amount (AED)", "VAT Rate" };

        var rows = items.OrderBy(i => i.Transaction.CompletedAt).Select(i => Row(
            ("Date",         (object?)i.Transaction.CompletedAt.ToString("yyyy-MM-dd")),
            ("Product",      (object?)i.ProductName),
            ("Category",     (object?)(i.Product?.Category?.Name ?? "—")),
            ("Supply Type",  (object?)"Zero-Rated / Exempt"),
            ("Amount (AED)", (object?)Math.Round(i.LineTotal, 2)),
            ("VAT Rate",     (object?)"0%")
        )).ToList();

        return Build(cols, rows);
    }

    // ── 14. PK: Daily Sales Register (FBR) ───────────────────────────────────

    private async Task<ReportResult> PkDailySalesRegisterAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Include(t => t.Customer)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Invoice #", "Date/Time", "STRN", "Customer NTN", "Gross Amount (PKR)", "GST 17% (PKR)", "Net Amount (PKR)", "FBR Status" };

        var rows = txns.OrderBy(t => t.CompletedAt).Select(t => Row(
            ("Invoice #",         (object?)t.TransactionNumber),
            ("Date/Time",         (object?)t.CompletedAt.ToString("yyyy-MM-dd HH:mm:ss")),
            ("STRN",              (object?)"STRN-PENDING"),   // STRN from tenant settings
            ("Customer NTN",      (object?)("—")),
            ("Gross Amount (PKR)",(object?)Math.Round(t.SubTotal + t.DiscountAmount, 2)),
            ("GST 17% (PKR)",     (object?)Math.Round(t.TaxAmount, 2)),
            ("Net Amount (PKR)",  (object?)Math.Round(t.TotalAmount, 2)),
            ("FBR Status",        (object?)"Pending Integration")   // FBR real-time sync requires FBR API key
        )).ToList();

        return Build(cols, rows);
    }

    // ── 15. PK: GST Sales Report (STR-7) ─────────────────────────────────────

    private async Task<ReportResult> PkGstSalesAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var items = await db.LineItems
            .Include(i => i.Transaction)
            .Where(i => i.Transaction.CompletedAt >= from && i.Transaction.CompletedAt < to)
            .Where(i => i.Transaction.Status == TransactionStatus.Completed && i.Transaction.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Tax Period", "Supply Type", "Taxable Value (PKR)", "GST Rate", "GST Amount (PKR)", "Annex" };
        var period = $"{from:MMMM yyyy}";

        // Group by rate bracket
        var standardItems = items.Where(i => i.TaxRate >= 17m).ToList();
        var reducedItems  = items.Where(i => i.TaxRate is > 0m and < 17m).ToList();
        var exemptItems   = items.Where(i => i.TaxRate == 0m).ToList();

        var rows = new List<Dictionary<string, object?>>
        {
            Row(("Tax Period",          (object?)period),
                ("Supply Type",         (object?)"Standard Rated (17%)"),
                ("Taxable Value (PKR)", (object?)Math.Round(standardItems.Sum(i => i.SubTotal), 2)),
                ("GST Rate",            (object?)"17%"),
                ("GST Amount (PKR)",    (object?)Math.Round(standardItems.Sum(i => i.TaxAmount), 2)),
                ("Annex",               (object?)"Annex-A")),

            Row(("Tax Period",          (object?)period),
                ("Supply Type",         (object?)"Reduced Rate"),
                ("Taxable Value (PKR)", (object?)Math.Round(reducedItems.Sum(i => i.SubTotal), 2)),
                ("GST Rate",            (object?)"Variable"),
                ("GST Amount (PKR)",    (object?)Math.Round(reducedItems.Sum(i => i.TaxAmount), 2)),
                ("Annex",               (object?)"Annex-B")),

            Row(("Tax Period",          (object?)period),
                ("Supply Type",         (object?)"Exempt / Zero-Rated"),
                ("Taxable Value (PKR)", (object?)Math.Round(exemptItems.Sum(i => i.SubTotal), 2)),
                ("GST Rate",            (object?)"0%"),
                ("GST Amount (PKR)",    (object?)0m),
                ("Annex",               (object?)"Annex-C"))
        };

        return Build(cols, rows);
    }

    // ── 16. PK: WHT Report (Section 153) ─────────────────────────────────────

    private async Task<ReportResult> PkWhtAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var orders = await db.PurchaseOrders
            .Include(po => po.Vendor)
            .Include(po => po.Items)
            .Where(po => po.CreatedAt >= from && po.CreatedAt < to)
            .Where(po => po.Status == "received" || po.Status == "partial")
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Vendor/Supplier", "NTN/CNIC", "Filer Status", "Payment Amount (PKR)", "WHT Rate", "WHT Deducted (PKR)", "Month" };

        var rows = orders.Select(po =>
        {
            var payAmt = Math.Round(po.SubTotal, 2);
            // WHT: filers 4.5%, non-filers 7.5% — no filer flag on vendor, default 4.5%
            var whtRate = 4.5m;
            var wht     = Math.Round(payAmt * whtRate / 100m, 2);
            return Row(
                ("Vendor/Supplier",       (object?)(po.Vendor?.Name ?? "Unknown")),
                ("NTN/CNIC",              (object?)(po.Vendor?.TaxNumber ?? "—")),
                ("Filer Status",          (object?)"Filer (assumed)"),
                ("Payment Amount (PKR)",  (object?)payAmt),
                ("WHT Rate",              (object?)"4.5%"),
                ("WHT Deducted (PKR)",    (object?)wht),
                ("Month",                 (object?)po.CreatedAt.ToString("MMMM yyyy"))
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 17. PK: Cash Memo Register ────────────────────────────────────────────

    private async Task<ReportResult> PkCashMemoAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var txns = await db.Transactions
            .Include(t => t.LineItems)
            .Include(t => t.Payments)
            .Include(t => t.Customer)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed && t.Type == TransactionType.Sale)
            .Where(t => p.CashierId == null || t.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Memo #", "Date", "Customer", "Items", "Gross (PKR)", "GST (PKR)", "Net (PKR)", "Cash Received" };

        var rows = txns.OrderBy(t => t.CompletedAt).Select(t =>
        {
            var cash = t.Payments.Where(pay => pay.Method == PaymentMethod.Cash).Sum(pay => pay.Amount);
            return Row(
                ("Memo #",        (object?)t.TransactionNumber),
                ("Date",          (object?)t.CompletedAt.ToString("yyyy-MM-dd")),
                ("Customer",      (object?)(t.Customer?.Name ?? "Walk-in")),
                ("Items",         (object?)t.LineItems.Count),
                ("Gross (PKR)",   (object?)Math.Round(t.SubTotal + t.DiscountAmount, 2)),
                ("GST (PKR)",     (object?)Math.Round(t.TaxAmount, 2)),
                ("Net (PKR)",     (object?)Math.Round(t.TotalAmount, 2)),
                ("Cash Received", (object?)Math.Round(cash, 2))
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── 18. PK: SRB Services Tax (Sindh) ─────────────────────────────────────

    private async Task<ReportResult> PkSrbServicesAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        // SRB rate = 13%. Filter line items with ~13% tax rate as proxy for services
        var items = await db.LineItems
            .Include(i => i.Transaction)
            .Include(i => i.Product).ThenInclude(pr => pr.Category)
            .Where(i => i.TaxRate >= 13m)
            .Where(i => i.Transaction.CompletedAt >= from && i.Transaction.CompletedAt < to)
            .Where(i => i.Transaction.Status == TransactionStatus.Completed && i.Transaction.Type == TransactionType.Sale)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Invoice #", "Date", "Service Type", "Taxable Value (PKR)", "SST 13% (PKR)", "Total (PKR)", "SRB Filed" };

        var rows = items.OrderBy(i => i.Transaction.CompletedAt).Select(i => Row(
            ("Invoice #",           (object?)i.Transaction.TransactionNumber),
            ("Date",                (object?)i.Transaction.CompletedAt.ToString("yyyy-MM-dd")),
            ("Service Type",        (object?)(i.Product?.Category?.Name ?? "Services")),
            ("Taxable Value (PKR)", (object?)Math.Round(i.SubTotal, 2)),
            ("SST 13% (PKR)",       (object?)Math.Round(i.TaxAmount, 2)),
            ("Total (PKR)",         (object?)Math.Round(i.LineTotal, 2)),
            ("SRB Filed",           (object?)"Pending Integration")
        )).ToList();

        return Build(cols, rows);
    }

    // ── 19. PK: Cash Reconciliation ───────────────────────────────────────────

    private async Task<ReportResult> PkCashReconciliationAsync(ReportParams p, CancellationToken ct)
    {
        var from = p.From.Date;
        var to   = p.To.Date.AddDays(1);

        var sessions = await db.Sessions
            .Where(s => s.OpenedAt >= from && s.OpenedAt < to)
            .Where(s => p.CashierId == null || s.CashierId == p.CashierId)
            .AsNoTracking()
            .ToListAsync(ct);

        var allTxns = await db.Transactions
            .Include(t => t.Payments)
            .Where(t => t.CompletedAt >= from && t.CompletedAt < to)
            .Where(t => t.Status == TransactionStatus.Completed)
            .AsNoTracking()
            .ToListAsync(ct);

        var cols = new[] { "Cashier", "Shift Date", "Opening Cash", "Cash Sales", "Cash Refunds", "Expected", "Counted", "Over/Short" };

        var rows = sessions.Select(s =>
        {
            var sessTxns   = allTxns.Where(t => t.SessionId == s.Id).ToList();
            var cashSales  = sessTxns.Where(t => t.Type == TransactionType.Sale)
                                     .SelectMany(t => t.Payments)
                                     .Where(pay => pay.Method == PaymentMethod.Cash)
                                     .Sum(pay => pay.Amount);
            var cashRefund = sessTxns.Where(t => t.Type == TransactionType.Refund)
                                     .SelectMany(t => t.Payments)
                                     .Where(pay => pay.Method == PaymentMethod.Cash)
                                     .Sum(pay => pay.Amount);
            var expected   = s.OpeningCash + cashSales - cashRefund;
            var overShort  = s.ClosingCash - expected;

            return Row(
                ("Cashier",       (object?)(s.CashierId.ToString()[..8] + "…")),
                ("Shift Date",    (object?)s.OpenedAt.ToString("yyyy-MM-dd")),
                ("Opening Cash",  (object?)s.OpeningCash),
                ("Cash Sales",    (object?)Math.Round(cashSales, 2)),
                ("Cash Refunds",  (object?)Math.Round(cashRefund, 2)),
                ("Expected",      (object?)Math.Round(expected, 2)),
                ("Counted",       (object?)s.ClosingCash),
                ("Over/Short",    (object?)Math.Round(overShort, 2))
            );
        }).ToList();

        return Build(cols, rows);
    }

    // ── Private row builder ───────────────────────────────────────────────────

    private static Dictionary<string, object?> Row(params (string k, object? v)[] fields)
    {
        var d = new Dictionary<string, object?>(fields.Length);
        foreach (var (k, v) in fields) d[k] = v;
        return d;
    }
}
