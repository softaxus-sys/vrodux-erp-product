using System.Globalization;
using System.Net;
using Softaxis.Finance.Application.Abstractions;
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

    public static (string Subject, string Html, IReadOnlyList<InlineImage> InlineImages) Build(
        Invoice invoice, InvoiceBranding brand)
    {
        var currency    = invoice.CurrencyCode;
        var companyName = brand.Name;
        var subject     = $"Invoice {invoice.InvoiceNumber} from {companyName}";

        // Letterhead images travel as MIME parts referenced by cid: — a data URI in an <img src>
        // is stripped by Gmail and blocked by Outlook, so they would simply not appear.
        var images = new List<InlineImage>();
        string Cid(string id, string? dataUri)
        {
            if (string.IsNullOrWhiteSpace(dataUri)) return string.Empty;
            images.Add(new InlineImage(id, dataUri!));
            return $"cid:{id}";
        }

        var logoSrc = Cid("invoice-logo", brand.LogoUrl);
        var signSrc = Cid("invoice-signature", brand.SignatureUrl);
        var stampSrc = Cid("invoice-stamp", brand.StampUrl);

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

        // Only the details that were filled in. A blank "TRN:" line reads as a fault.
        var issuerDetails = string.Join(" &nbsp;·&nbsp; ", new[]
            {
                brand.Address, brand.Phone, brand.Email, brand.Website,
                string.IsNullOrWhiteSpace(brand.TaxNumber) ? null : $"TRN: {brand.TaxNumber}",
            }
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => E(v!.Trim())));

        var issuerBlock = string.IsNullOrWhiteSpace(issuerDetails)
            ? string.Empty
            : $@"<p style=""margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;
                    font-size:11px;color:#9ca3af;line-height:1.6"">{issuerDetails}</p>";

        // Rendered only when something exists, so a workspace with no signature does not get an
        // empty box and a stray rule.
        var signOff = (signSrc.Length > 0 || stampSrc.Length > 0)
            ? $@"
      <table style=""width:100%;margin-top:28px;border-collapse:collapse"">
        <tr>
          <td style=""vertical-align:bottom;width:60%"">
            {(signSrc.Length > 0
              ? $@"<img src=""{signSrc}"" alt="""" style=""max-height:56px;max-width:200px;display:block;margin-bottom:4px"" />"
              : string.Empty)}
            <div style=""border-top:1px solid #111827;width:200px;margin-bottom:5px""></div>
            <div style=""font-size:12px;color:#6b7280"">Authorised signatory</div>
            <div style=""font-size:12px;color:#6b7280"">for {E(companyName)}</div>
          </td>
          <td style=""vertical-align:bottom;text-align:right"">
            {(stampSrc.Length > 0
              ? $@"<img src=""{stampSrc}"" alt="""" style=""max-height:96px;max-width:140px"" />"
              : string.Empty)}
          </td>
        </tr>
      </table>"
            : string.Empty;

        var html = $@"
<div style=""font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f7;padding:24px"">
  <div style=""max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb"">
    <div style=""background:#0f172a;padding:20px 24px"">
      {(logoSrc.Length > 0
        ? $@"<img src=""{logoSrc}"" alt="""" style=""max-height:40px;max-width:170px;margin-bottom:10px"" />"
        : string.Empty)}
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

      {signOff}

      <p style=""margin-top:24px;font-size:12px;color:#6b7280"">
        If you have already paid, please disregard this notice or reply with the payment reference.
      </p>

      {issuerBlock}
    </div>
  </div>
</div>";

        return (subject, html, images);
    }
}
