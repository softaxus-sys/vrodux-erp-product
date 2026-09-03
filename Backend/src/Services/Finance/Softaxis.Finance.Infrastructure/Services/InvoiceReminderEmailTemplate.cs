using System.Globalization;
using System.Net;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// The polite nudge sent as an invoice approaches its due date.
///
/// <para>Deliberately not a copy of the invoice email. A customer who has already received the
/// invoice does not need it re-explained line by line — they need the number, the amount still
/// outstanding, and the date. The invoice itself rides along as the PDF attachment for anyone who
/// has lost it.</para>
///
/// <para>Wording softens or hardens with the remaining days, because a message that reads the same
/// seven days out as it does on the final day trains people to ignore it.</para>
///
/// Same rules as the other templates: all CSS inlined, because mail clients strip stylesheets, and
/// every interpolated value HTML-encoded, because a customer name like "Smith &amp; Co &lt;Ltd&gt;"
/// would otherwise break the markup.
/// </summary>
internal static class InvoiceReminderEmailTemplate
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Money(decimal amount, string currency) =>
        $"{E(currency)} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    public static (string Subject, string Html, IReadOnlyList<InlineImage> InlineImages) Build(
        Invoice invoice, InvoiceBranding brand, int daysUntilDue)
    {
        var currency    = invoice.CurrencyCode;
        var companyName = brand.Name;
        var outstanding = invoice.AmountDue;

        var when = daysUntilDue switch
        {
            <= 0 => "due today",
            1    => "due tomorrow",
            _    => $"due in {daysUntilDue} days",
        };

        var subject = $"Reminder — Invoice {invoice.InvoiceNumber} is {when}";

        var images = new List<InlineImage>();
        string Cid(string id, string? dataUri)
        {
            if (string.IsNullOrWhiteSpace(dataUri)) return string.Empty;
            images.Add(new InlineImage(id, dataUri!));
            return $"cid:{id}";
        }

        var logoSrc = Cid("reminder-logo", brand.LogoUrl);

        // Only shown when part of the invoice has been paid. Sending someone a reminder for the full
        // amount when they have already paid half is the fastest way to lose their trust in it.
        var paidRow = invoice.AmountPaid > 0.01m
            ? $@"<tr><td style=""padding:6px 0;color:#6b7280"">Already paid</td>
                 <td style=""padding:6px 0;text-align:right;color:#15803d"">{Money(invoice.AmountPaid, currency)}</td></tr>"
            : string.Empty;

        var html = $@"
<div style=""font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;padding:24px"">
  <div style=""max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"">

    <div style=""background:#1e293b;padding:20px 24px"">
      {(logoSrc.Length > 0
        // On a white plate, for the reason given in the other templates: a dark logo on a
        // transparent background vanishes against the header. A table, not an inline-block div,
        // because Outlook renders with Word's engine.
        ? $@"<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin-bottom:12px"">
               <tr><td style=""background:#ffffff;border-radius:6px;padding:8px 12px"">
                 <img src=""{logoSrc}"" alt="""" style=""max-height:32px;max-width:150px;display:block"" />
               </td></tr>
             </table>"
        : string.Empty)}
      <div style=""color:#ffffff;font-size:18px;font-weight:600"">Payment reminder</div>
      <div style=""color:#cbd5e1;font-size:13px;margin-top:2px"">{E(companyName)}</div>
    </div>

    <div style=""padding:24px"">
      <p style=""margin:0 0 16px;font-size:14px;color:#111827"">
        Hello {E(invoice.CustomerName)},
      </p>
      <p style=""margin:0 0 20px;font-size:14px;color:#374151;line-height:1.55"">
        This is a friendly reminder that invoice
        <strong>{E(invoice.InvoiceNumber)}</strong> is <strong>{E(when)}</strong>.
        The invoice is attached for your reference.
      </p>

      <table style=""width:100%;border-collapse:collapse;font-size:13px"">
        <tr><td style=""padding:6px 0;color:#6b7280"">Invoice</td>
            <td style=""padding:6px 0;text-align:right"">{E(invoice.InvoiceNumber)}</td></tr>
        <tr><td style=""padding:6px 0;color:#6b7280"">Due date</td>
            <td style=""padding:6px 0;text-align:right"">{E(invoice.DueDate)}</td></tr>
        <tr><td style=""padding:6px 0;color:#6b7280"">Invoice total</td>
            <td style=""padding:6px 0;text-align:right"">{Money(invoice.Total, currency)}</td></tr>
        {paidRow}
        <tr><td style=""padding:10px 0 6px;border-top:1px solid #e5e7eb;font-weight:600"">Amount due</td>
            <td style=""padding:10px 0 6px;border-top:1px solid #e5e7eb;text-align:right;font-weight:700;font-size:15px"">
              {Money(outstanding, currency)}</td></tr>
      </table>

      <p style=""margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.5"">
        If you have already arranged payment, please ignore this message — our records may not have
        caught up yet.
      </p>
    </div>

    <div style=""padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af"">
      {E(companyName)}{(string.IsNullOrWhiteSpace(brand.Address) ? string.Empty : " · " + E(brand.Address))}
    </div>
  </div>
</div>";

        return (subject, html, images);
    }
}
