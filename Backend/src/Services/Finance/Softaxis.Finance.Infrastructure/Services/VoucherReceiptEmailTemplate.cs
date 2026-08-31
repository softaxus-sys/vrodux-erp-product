using System.Globalization;
using System.Net;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The receipt for a posted receipt voucher.
///
/// <para>Separate from the single-invoice receipt because a voucher is a different thing: one
/// payment that can settle several invoices, in part or in full. The customer needs to see how
/// their money was split, not just that it arrived — otherwise a payment covering three invoices
/// looks identical to one covering a single invoice, and neither side can reconcile it later.</para>
/// </summary>
internal static class VoucherReceiptEmailTemplate
{
    /// <summary>One settled invoice: what it was, what was applied, what is left.</summary>
    internal readonly record struct AppliedLine(string InvoiceNumber, decimal Applied, decimal RemainingAfter);

    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Money(decimal amount, string currency) =>
        $"{E(currency)} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    public static (string Subject, string Html, IReadOnlyList<InlineImage> InlineImages) Build(
        ReceiptVoucher voucher, InvoiceBranding brand, IReadOnlyList<AppliedLine> applied)
    {
        var currency    = voucher.CurrencyCode;
        var companyName = brand.Name;
        var subject     = $"Payment received — receipt {voucher.VoucherNumber}";

        var images = new List<InlineImage>();
        string Cid(string id, string? dataUri)
        {
            if (string.IsNullOrWhiteSpace(dataUri)) return string.Empty;
            images.Add(new InlineImage(id, dataUri!));
            return $"cid:{id}";
        }

        var logoSrc  = Cid("voucher-logo", brand.LogoUrl);
        var stampSrc = Cid("voucher-stamp", brand.StampUrl);

        var rows = string.Concat(applied.Select(a => $@"
<tr>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9"">{E(a.InvoiceNumber)}</td>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600"">{Money(a.Applied, currency)}</td>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:{(a.RemainingAfter > 0.01m ? "#b45309" : "#15803d")}"">
    {(a.RemainingAfter > 0.01m ? Money(a.RemainingAfter, currency) : "Settled")}</td>
</tr>"));

        // Money received but not applied to any invoice. Saying so matters: it is the customer's
        // credit, and a receipt that quietly omits it looks like the payment was short.
        var unapplied = voucher.Amount - applied.Sum(a => a.Applied);
        var unappliedRow = unapplied > 0.01m
            ? $@"<tr><td style=""padding:6px 0;color:#6b7280"">Held on account</td>
                 <td colspan=""2"" style=""padding:6px 0;text-align:right;font-weight:600"">{Money(unapplied, currency)}</td></tr>"
            : string.Empty;

        var methodRow = string.IsNullOrWhiteSpace(voucher.ReceiptMethod)
            ? string.Empty
            : $@"<tr><td style=""padding:4px 0;color:#6b7280"">Method</td>
                 <td style=""padding:4px 0;text-align:right"">{E(voucher.ReceiptMethod)}</td></tr>";

        var referenceRow = string.IsNullOrWhiteSpace(voucher.Reference)
            ? string.Empty
            : $@"<tr><td style=""padding:4px 0;color:#6b7280"">Reference</td>
                 <td style=""padding:4px 0;text-align:right"">{E(voucher.Reference)}</td></tr>";

        var issuerDetails = string.Join(" &nbsp;·&nbsp; ", new[]
            {
                brand.Address, brand.Phone, brand.Email, brand.Website,
                string.IsNullOrWhiteSpace(brand.TaxNumber) ? null : $"TRN: {brand.TaxNumber}",
            }
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => E(v!.Trim())));

        var html = $@"
<div style=""font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f7;padding:24px"">
  <div style=""max-width:620px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb"">
    <div style=""background:#15803d;padding:20px 24px"">
      {(logoSrc.Length > 0
        ? $@"<img src=""{logoSrc}"" alt="""" style=""max-height:36px;max-width:160px;margin-bottom:10px"" />"
        : string.Empty)}
      <div style=""color:#ffffff;font-size:18px;font-weight:600"">Payment received</div>
      <div style=""color:#dcfce7;font-size:13px;margin-top:2px"">{E(companyName)} &middot; {E(voucher.VoucherNumber)}</div>
    </div>

    <div style=""padding:24px;font-size:14px;color:#111827"">
      <p style=""margin:0 0 18px"">Dear {E(voucher.CustomerName)},</p>
      <p style=""margin:0 0 20px"">Thank you — we have received
        <strong>{Money(voucher.Amount, currency)}</strong> on {E(voucher.ReceiptDate)}.
        This email is your receipt.</p>

      <table style=""width:100%;border-collapse:collapse;font-size:13px"">
        <tr style=""color:#6b7280;text-align:left"">
          <th style=""padding:0 0 8px;font-weight:500"">Invoice</th>
          <th style=""padding:0 0 8px;font-weight:500;text-align:right"">Applied</th>
          <th style=""padding:0 0 8px;font-weight:500;text-align:right"">Balance after</th>
        </tr>
        {rows}
        {unappliedRow}
        <tr><td style=""padding:10px 0;font-weight:700;font-size:15px"">Total received</td>
            <td colspan=""2"" style=""padding:10px 0;text-align:right;font-weight:700;font-size:15px"">
              {Money(voucher.Amount, currency)}</td></tr>
      </table>

      <table style=""width:100%;border-collapse:collapse;font-size:13px;margin-top:16px"">
        <tr><td style=""padding:4px 0;color:#6b7280"">Received on</td>
            <td style=""padding:4px 0;text-align:right"">{E(voucher.ReceiptDate)}</td></tr>
        {methodRow}
        {referenceRow}
      </table>

      {(stampSrc.Length > 0
        ? $@"<div style=""margin-top:24px;text-align:right""><img src=""{stampSrc}"" alt="""" style=""max-height:88px;max-width:130px"" /></div>"
        : string.Empty)}

      <p style=""margin-top:24px;font-size:12px;color:#6b7280"">
        Please keep this receipt for your records.
      </p>

      {(string.IsNullOrWhiteSpace(issuerDetails) ? string.Empty :
        $@"<p style=""margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;
             font-size:11px;color:#9ca3af;line-height:1.6"">{issuerDetails}</p>")}
    </div>
  </div>
</div>";

        return (subject, html, images);
    }
}
