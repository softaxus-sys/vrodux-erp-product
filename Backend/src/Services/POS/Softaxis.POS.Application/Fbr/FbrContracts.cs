using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Application.Fbr;

// ─────────────────────────────────────────────────────────────────────────────
//  FBR (Pakistan) IMS POS integration - the invoice payload and the client seam.
//
//  ⚠ Field names, payment-mode codes and invoice-type codes follow FBR's published POS
//  integration API as generally documented. VERIFY them against the current FBR/PRAL API
//  document and the sandbox before going live - this is the one file to adjust if they differ.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>One invoice as FBR's PostData API expects it.</summary>
public sealed record FbrInvoice
{
    /// <summary>Always empty on submission - FBR assigns and returns it.</summary>
    public string  InvoiceNumber    { get; init; } = "";
    public long    POSID            { get; init; }
    /// <summary>The store's own unique invoice number (our transaction number).</summary>
    public string  USIN             { get; init; } = "";
    /// <summary>yyyy-MM-dd HH:mm:ss, Pakistan local time.</summary>
    public string  DateTime         { get; init; } = "";
    public string? BuyerNTN         { get; init; }
    public string? BuyerCNIC        { get; init; }
    public string? BuyerName        { get; init; }
    public string? BuyerPhoneNumber { get; init; }
    public decimal TotalBillAmount  { get; init; }
    public decimal TotalQuantity    { get; init; }
    public decimal TotalSaleValue   { get; init; }
    public decimal TotalTaxCharged  { get; init; }
    public decimal Discount         { get; init; }
    public decimal FurtherTax       { get; init; }
    /// <summary>1 Cash, 2 Card, 3 Gift voucher, 4 Loyalty card, 5 Mixed, 6 Cheque.</summary>
    public int     PaymentMode      { get; init; }
    public string? RefUSIN          { get; init; }
    /// <summary>1 New sale, 2 Debit note, 3 Credit note (return).</summary>
    public int     InvoiceType      { get; init; } = 1;
    public IReadOnlyList<FbrInvoiceItem> Items { get; init; } = [];
}

public sealed record FbrInvoiceItem
{
    public string  ItemCode    { get; init; } = "";
    public string  ItemName    { get; init; } = "";
    public decimal Quantity    { get; init; }
    public string  PCTCode     { get; init; } = "";
    public decimal TaxRate     { get; init; }
    /// <summary>Value before tax, after discount.</summary>
    public decimal SaleValue   { get; init; }
    /// <summary>Value including tax.</summary>
    public decimal TotalAmount { get; init; }
    public decimal TaxCharged  { get; init; }
    public decimal Discount    { get; init; }
    public decimal FurtherTax  { get; init; }
    public int     InvoiceType { get; init; } = 1;
    public string? RefUSIN     { get; init; }
}

/// <param name="Permanent">
/// FBR rejected the invoice data itself - resending the same payload cannot succeed. False for
/// connection problems, timeouts and server errors, which are retried.
/// </param>
public sealed record FbrSubmitResult(bool Success, string? InvoiceNumber, string? Error, bool Permanent)
{
    public static FbrSubmitResult Ok(string number)            => new(true, number, null, false);
    public static FbrSubmitResult Retry(string error)          => new(false, null, error, false);
    public static FbrSubmitResult Rejected(string error)       => new(false, null, error, true);
}

/// <summary>Calls FBR's IMS API.</summary>
public interface IFbrClient
{
    Task<FbrSubmitResult> SubmitAsync(FbrInvoice invoice, string environment, string token, CancellationToken ct);
}

/// <summary>Builds the FBR payload from a completed sale.</summary>
public static class FbrInvoiceBuilder
{
    /// <summary>Pakistan Standard Time (UTC+5, no DST) - FBR expects local time.</summary>
    private static readonly TimeSpan PkOffset = TimeSpan.FromHours(5);

    public static FbrInvoice Build(POSTransaction txn, long posId, string? defaultPctCode, string? customerName)
    {
        var items = txn.LineItems.Select(li => new FbrInvoiceItem
        {
            ItemCode    = Trunc(li.ProductSKU ?? li.ProductBarcode ?? li.ProductId.ToString("N")[..12], 50),
            ItemName    = Trunc(li.ProductName, 150),
            Quantity    = li.Quantity,
            PCTCode     = string.IsNullOrWhiteSpace(defaultPctCode) ? "00000000" : defaultPctCode!,
            TaxRate     = li.TaxRate,
            SaleValue   = li.SubTotal,
            TotalAmount = li.LineTotal,
            TaxCharged  = li.TaxAmount,
            Discount    = li.DiscountAmount,
            InvoiceType = 1,
        }).ToList();

        return new FbrInvoice
        {
            POSID            = posId,
            USIN             = txn.TransactionNumber,
            DateTime         = (txn.CompletedAt + PkOffset).ToString("yyyy-MM-dd HH:mm:ss"),
            BuyerName        = customerName,
            TotalBillAmount  = txn.TotalAmount,
            TotalQuantity    = items.Sum(i => i.Quantity),
            TotalSaleValue   = items.Sum(i => i.SaleValue),
            TotalTaxCharged  = txn.TaxAmount,
            Discount         = txn.DiscountAmount,
            PaymentMode      = PaymentModeOf(txn),
            InvoiceType      = 1,
            Items            = items,
        };
    }

    private static int PaymentModeOf(POSTransaction txn)
    {
        var methods = txn.Payments.Select(p => p.Method).Distinct().ToList();
        if (methods.Count != 1) return 5;                       // mixed
        return methods[0] switch
        {
            PaymentMethod.Cash          => 1,
            PaymentMethod.Card          => 2,
            PaymentMethod.StoreCredit   => 3,
            PaymentMethod.Cheque        => 6,
            PaymentMethod.DigitalWallet => 2,                   // card / electronic
            PaymentMethod.BankTransfer  => 2,
            _                           => 1,
        };
    }

    private static string Trunc(string s, int n) => s.Length <= n ? s : s[..n];
}
