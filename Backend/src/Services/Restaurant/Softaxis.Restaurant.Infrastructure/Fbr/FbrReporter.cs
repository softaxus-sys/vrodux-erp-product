using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Application.Fbr;
using Softaxis.POS.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Fbr;

/// <summary>
/// Reports a paid bill to FBR and stores the fiscal invoice number on it. Never throws and never
/// blocks the sale: a bill FBR could not take stays "failed" and is retried by FbrRetryService.
/// </summary>
public sealed class FbrReporter(RestaurantDbContext db, POSDbContext posDb, IFbrClient client,
    ISecretProtector secrets, Softaxis.POS.Application.Abstractions.ISecretProtector posSecrets)
{
    public sealed record Report(string? Status, string? InvoiceNumber, string? Error);

    /// <summary>A bill stuck in "sending" this long is assumed lost and may be sent again.</summary>
    internal static readonly TimeSpan SendingTimeout = TimeSpan.FromMinutes(5);

    public async Task<Report?> ReportAsync(Guid orderId, CancellationToken ct)
    {
        try
        {
            // Claim the bill first, so two requests (or a request and the retry job) never both
            // send it — each send creates a separate fiscal invoice at FBR.
            var stale = DateTime.UtcNow - SendingTimeout;
            var claimed = await db.Orders
                .Where(o => o.Id == orderId && o.Status == "paid"
                         && (o.FbrStatus == "pending" || o.FbrStatus == "failed"
                             || (o.FbrStatus == "sending" && o.UpdatedAt < stale)))
                .ExecuteUpdateAsync(s => s.SetProperty(o => o.FbrStatus, "sending")
                                          .SetProperty(o => o.UpdatedAt, DateTime.UtcNow), ct);
            if (claimed == 0) return null;

            db.ChangeTracker.Clear();
            var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Payments)
                .FirstAsync(o => o.Id == orderId, ct);

            var account = await TaxProfileResolver.FbrAccountAsync(db, posDb, secrets, posSecrets, order.BranchId, ct);
            var outcome = account is null
                ? FbrSubmitResult.Retry("FBR is not set up for this branch or workspace (POS ID and token are needed).")
                : await client.SubmitAsync(RestaurantFbrInvoice.Build(order, account.PosId, account.PctCode),
                    account.Environment, account.Token, ct);

            return await ConcurrencyRetry.ExecuteAsync(db, async () =>
            {
                var tracked = await db.Orders.FirstAsync(o => o.Id == orderId, ct);
                if (outcome.Success) tracked.RecordFbrSuccess(outcome.InvoiceNumber!);
                else tracked.RecordFbrFailure(outcome.Error ?? "FBR did not accept the invoice.", outcome.Permanent);
                await db.SaveChangesAsync(ct);
                return new Report(tracked.FbrStatus, tracked.FbrInvoiceNumber, tracked.FbrError);
            });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new Report("failed", null, ex.Message);
        }
    }
}

/// <summary>Turns a paid bill into FBR's invoice shape. Pure, so it is easy to check.</summary>
public static class RestaurantFbrInvoice
{
    /// <summary>Pakistan Standard Time — FBR expects the local time of sale.</summary>
    private static readonly TimeSpan Pkt = TimeSpan.FromHours(5);

    public static FbrInvoice Build(Order o, long posId, string pctCode)
    {
        var lines = o.Items.Where(i => !i.IsDeleted && i.LineTotal > 0).ToList();
        var items = new List<FbrInvoiceItem>();
        decimal discountLeft = o.DiscountAmount, taxLeft = o.TaxAmount;
        for (var i = 0; i < lines.Count; i++)
        {
            var l = lines[i];
            var last = i == lines.Count - 1;
            // Discount and tax are spread over the lines by value; rounding is absorbed by the last
            // line so the lines always add up to the bill.
            var disc = last ? discountLeft : Math.Round(o.SubTotal == 0 ? 0 : o.DiscountAmount * l.LineTotal / o.SubTotal, 2);
            var sale = l.LineTotal - disc;
            var tax = last ? taxLeft : Math.Round(Math.Max(0, sale) * o.TaxRate / 100m, 2);
            discountLeft -= disc; taxLeft -= tax;
            items.Add(new FbrInvoiceItem
            {
                ItemCode = l.MenuItemId.ToString("N")[..12].ToUpperInvariant(),
                ItemName = l.ItemName,
                Quantity = l.Quantity,
                PCTCode = pctCode,
                TaxRate = o.TaxRate,
                SaleValue = sale,
                Discount = disc,
                TaxCharged = tax,
                TotalAmount = sale + tax,
            });
        }

        var paidAt = o.Payments.Count > 0 ? o.Payments.Max(p => p.CreatedAt) : o.UpdatedAt;
        return new FbrInvoice
        {
            POSID = posId,
            USIN = o.OrderNumber,
            DateTime = (paidAt + Pkt).ToString("yyyy-MM-dd HH:mm:ss"),
            TotalBillAmount = o.Total,
            TotalQuantity = lines.Sum(l => l.Quantity),
            TotalSaleValue = o.SubTotal - o.DiscountAmount,
            TotalTaxCharged = o.TaxAmount,
            Discount = o.DiscountAmount,
            PaymentMode = PaymentMode(o.Payments.Select(p => p.Method)),
            Items = items,
        };
    }

    /// <summary>FBR payment modes: 1 cash, 2 card, 3 gift voucher, 4 loyalty, 5 mixed, 6 cheque.</summary>
    public static int PaymentMode(IEnumerable<string> methods)
    {
        var modes = methods.Select(m => m.Trim().ToLowerInvariant() switch
        {
            "cash" => 1,
            var x when x.Contains("voucher") || x.Contains("gift") => 3,
            var x when x.Contains("loyal") => 4,
            var x when x.Contains("cheque") || x.Contains("check") => 6,
            _ => 2,   // card, wallet, house account, bank transfer — all non-cash
        }).Distinct().ToList();
        return modes.Count switch { 0 => 1, 1 => modes[0], _ => 5 };
    }
}
