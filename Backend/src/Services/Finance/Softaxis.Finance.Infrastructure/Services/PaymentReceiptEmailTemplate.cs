using System.Globalization;
using System.Net;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The "we have received your payment" confirmation, sent when an invoice is settled.
///
/// Deliberately a separate message from the invoice: it answers a different question (what did you
/// receive, when, and is anything still outstanding), and it is the thing a customer keeps as proof
/// of payment. Same inlining and HTML-encoding rules as the invoice template.
/// </summary>
internal static class PaymentReceiptEmailTemplate
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Money(decimal amount, string currency) =>
        $"{E(currency)} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    public static (string Subject, string Html, IReadOnlyList<InlineImage> InlineImages) Build(
        Invoice invoice, InvoiceBranding brand, decimal amountReceived, string receivedOn, string? method)
    {
        var currency    = invoice.CurrencyCode;
        var companyName = brand.Name;
        var subject     = $"Payment received — Invoice {invoice.InvoiceNumber}";

        var images = new List<InlineImage>();
        string Cid(string id, string? dataUri)
        {
            if (string.IsNullOrWhiteSpace(dataUri)) return string.Empty;
            images.Add(new InlineImage(id, dataUri!));
            return $"cid:{id}";
        }

        var logoSrc  = Cid("receipt-logo", brand.LogoUrl);
        var stampSrc = Cid("receipt-stamp", brand.StampUrl);

        // Stated explicitly rather than assumed settled. If a receipt says nothing about the
        // balance, a customer with a part-paid account has no way to know they still owe anything.
        var outstanding = invoice.AmountDue;
        var balanceRow = outstanding > 0.01m
            ? $@"<tr><td style=""padding:6px 0;color:#6b7280"">Still outstanding</td>
                 <td style=""padding:6px 0;text-align:right;font-weight:700;color:#b45309"">{Money(outstanding, currency)}</td></tr>"
            : $@"<tr><td style=""padding:6px 0;color:#6b7280"">Balance</td>
                 <td style=""padding:6px 0;text-align:right;font-weight:700;color:#15803d"">Paid in full</td></tr>";

        var methodRow = string.IsNullOrWhiteSpace(method)
            ? string.Empty
            : $@"<tr><td style=""padding:6px 0;color:#6b7280"">Method</td>
                 <td style=""padding:6px 0;text-align:right"">{E(method)}</td></tr>";

        var issuerDetails = string.Join(" &nbsp;·&nbsp; ", new[]
            {
                brand.Address, brand.Phone, brand.Email, brand.Website,
                string.IsNullOrWhiteSpace(brand.TaxNumber) ? null : $"TRN: {brand.TaxNumber}",
            }
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => E(v!.Trim())));

        var html = $@"
<div style=""font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f7;padding:24px"">
  <div style=""max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb"">
    <div style=""background:#15803d;padding:20px 24px"">
      {(logoSrc.Length > 0
        ? $@"<img src=""{logoSrc}"" alt="""" style=""max-height:36px;max-width:160px;margin-bottom:10px"" />"
        : string.Empty)}
      <div style=""color:#ffffff;font-size:18px;font-weight:600"">Payment received</div>
      <div style=""color:#dcfce7;font-size:13px;margin-top:2px"">{E(companyName)}</div>
    </div>

    <div style=""padding:24px;font-size:14px;color:#111827"">
      <p style=""margin:0 0 18px"">Dear {E(invoice.CustomerName)},</p>
      <p style=""margin:0 0 20px"">Thank you — we have received your payment. This email is your receipt.</p>

      <table style=""width:100%;border-collapse:collapse;font-size:13px"">
        <tr><td style=""padding:6px 0;color:#6b7280"">Invoice</td>
            <td style=""padding:6px 0;text-align:right;font-weight:600"">{E(invoice.InvoiceNumber)}</td></tr>
        <tr><td style=""padding:6px 0;color:#6b7280"">Invoice total</td>
            <td style=""padding:6px 0;text-align:right"">{Money(invoice.Total, currency)}</td></tr>
        <tr><td style=""padding:6px 0;color:#6b7280"">Amount received</td>
            <td style=""padding:6px 0;text-align:right;font-weight:700;font-size:15px"">{Money(amountReceived, currency)}</td></tr>
        <tr><td style=""padding:6px 0;color:#6b7280"">Received on</td>
            <td style=""padding:6px 0;text-align:right"">{E(receivedOn)}</td></tr>
        {methodRow}
        {balanceRow}
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
