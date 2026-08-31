using System.Globalization;
using System.Net;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The invoice email body. Everything is inlined — mail clients strip stylesheets and block remote
/// images, so anything external simply would not render. Every interpolated value is HTML-encoded:
/// a customer named "Smith &amp; Co &lt;Ltd&gt;" would otherwise break the markup, and both the
/// name and the line descriptions come from user input.
/// </summary>
internal static class InvoiceEmailTemplate
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Money(decimal amount, string currency) =>
        $"{E(currency)} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    public static (string Subject, string Html) Build(Invoice invoice, string companyName)
    {
        var currency = invoice.CurrencyCode;
        var subject  = $"Invoice {invoice.InvoiceNumber} from {companyName}";

        var lines = string.Concat(invoice.Items.Select(i => $@"
<tr>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9"">{E(i.Description)}</td>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right"">{i.Quantity.ToString("0.##", CultureInfo.InvariantCulture)}</td>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right"">{Money(i.UnitPrice, currency)}</td>
  <td style=""padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600"">{Money(i.Quantity * i.UnitPrice, currency)}</td>
</tr>"));

        // Only shown when there is tax. A "VAT 0.00" row on a zero-rated invoice invites the
        // question of whether something was configured wrong.
        var taxRow = invoice.TaxRate > 0
            ? $@"<tr><td colspan=""3"" style=""padding:4px 0;text-align:right;color:#6b7280"">
                   VAT ({invoice.TaxRate.ToString("0.##", CultureInfo.InvariantCulture)}%)</td>
                 <td style=""padding:4px 0;text-align:right"">{Money(invoice.TaxAmount, currency)}</td></tr>"
            : string.Empty;

        var html = $@"
<div style=""font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f7;padding:24px"">
  <div style=""max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb"">
    <div style=""background:#0f172a;padding:20px 24px"">
      <div style=""color:#ffffff;font-size:18px;font-weight:600"">Invoice {E(invoice.InvoiceNumber)}</div>
      <div style=""color:#cbd5e1;font-size:13px;margin-top:2px"">{E(companyName)}</div>
    </div>

    <div style=""padding:24px;font-size:14px;color:#111827"">
      <p style=""margin:0 0 16px"">Dear {E(invoice.CustomerName)},</p>
      <p style=""margin:0 0 20px"">Please find your invoice below. Payment is due by
        <strong>{E(invoice.DueDate)}</strong>.</p>

      <table style=""width:100%;border-collapse:collapse;font-size:13px"">
        <tr style=""color:#6b7280;text-align:left"">
          <th style=""padding:0 0 8px;font-weight:500"">Description</th>
          <th style=""padding:0 0 8px;font-weight:500;text-align:right"">Qty</th>
          <th style=""padding:0 0 8px;font-weight:500;text-align:right"">Unit price</th>
          <th style=""padding:0 0 8px;font-weight:500;text-align:right"">Amount</th>
        </tr>
        {lines}
        <tr><td colspan=""3"" style=""padding:10px 0 4px;text-align:right;color:#6b7280"">Subtotal</td>
            <td style=""padding:10px 0 4px;text-align:right"">{Money(invoice.SubTotal, currency)}</td></tr>
        {taxRow}
        <tr><td colspan=""3"" style=""padding:8px 0;text-align:right;font-weight:700;font-size:15px"">Total due</td>
            <td style=""padding:8px 0;text-align:right;font-weight:700;font-size:15px"">{Money(invoice.Total, currency)}</td></tr>
      </table>

      <table style=""width:100%;border-collapse:collapse;font-size:13px;margin-top:20px;color:#6b7280"">
        <tr><td style=""padding:3px 0"">Invoice date</td><td style=""text-align:right;color:#111827"">{E(invoice.InvoiceDate)}</td></tr>
        <tr><td style=""padding:3px 0"">Due date</td><td style=""text-align:right;color:#111827"">{E(invoice.DueDate)}</td></tr>
      </table>

      {(string.IsNullOrWhiteSpace(invoice.Notes) ? string.Empty :
        $@"<p style=""margin-top:20px;font-size:13px;color:#6b7280"">{E(invoice.Notes)}</p>")}

      <p style=""margin-top:24px;font-size:12px;color:#6b7280"">
        If you have already paid, please disregard this notice or reply with the payment reference.
      </p>
    </div>
  </div>
</div>";

        return (subject, html);
    }
}
