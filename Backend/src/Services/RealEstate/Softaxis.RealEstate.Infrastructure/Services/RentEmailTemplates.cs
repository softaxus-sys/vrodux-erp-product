using System.Globalization;
using System.Net;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Services;

/// <summary>
/// The notice bodies. Plain inlined HTML with no external assets — mail clients strip stylesheets
/// and block remote images by default, so anything not inlined simply would not render.
///
/// Every interpolated value is HTML-encoded: a tenant named <c>Smith &amp; Co &lt;Ltd&gt;</c> would
/// otherwise break the markup, and the name comes from user input.
/// </summary>
internal static class RentEmailTemplates
{
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? string.Empty);

    private static string Money(decimal amount, string currency) =>
        $"{E(currency)} {amount.ToString("N2", CultureInfo.InvariantCulture)}";

    private static string Shell(string heading, string accent, string bodyRows, string? callout) => $@"
<div style=""font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f7;padding:24px"">
  <div style=""max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb"">
    <div style=""background:{accent};padding:20px 24px"">
      <div style=""color:#ffffff;font-size:18px;font-weight:600"">{heading}</div>
    </div>
    <div style=""padding:24px"">
      {callout ?? string.Empty}
      <table style=""width:100%;border-collapse:collapse;font-size:14px;color:#111827"">{bodyRows}</table>
      <p style=""margin-top:24px;font-size:12px;color:#6b7280"">
        This is an automated notice. If you have already paid, please disregard it or reply with the payment reference.
      </p>
    </div>
  </div>
</div>";

    private static string Row(string label, string value) => $@"
<tr>
  <td style=""padding:8px 0;color:#6b7280;width:45%"">{E(label)}</td>
  <td style=""padding:8px 0;font-weight:600;text-align:right"">{value}</td>
</tr>";

    private static string Callout(string text, string bg, string fg) => $@"
<div style=""background:{bg};color:{fg};padding:12px 14px;border-radius:8px;font-size:14px;margin-bottom:18px"">{E(text)}</div>";

    public static (string Subject, string Html) RentDue(
        LeaseContract c, RentInstallment i, string tenantName, int daysUntilDue, string currency)
    {
        var when = daysUntilDue <= 0 ? "today"
                 : daysUntilDue == 1 ? "tomorrow"
                 : $"in {daysUntilDue} days";

        var subject = $"Rent due {when} — {c.PropertyName} {c.UnitNumber}";

        var html = Shell(
            "Upcoming rent payment", "#2563eb",
            Row("Tenant", E(tenantName)) +
            Row("Property", E(c.PropertyName) + " &middot; " + E(c.UnitNumber)) +
            Row("Contract", E(c.ContractNumber)) +
            Row("Installment", $"{i.InstallmentNumber} of {c.Cheques}") +
            Row("Due date", E(i.DueDate)) +
            Row("Amount due", Money(i.Balance, currency)),
            Callout($"Your rent payment is due {when}.", "#eff6ff", "#1e40af"));

        return (subject, html);
    }

    public static (string Subject, string Html) RentOverdue(
        LeaseContract c, RentInstallment i, string tenantName, int daysOverdue, string currency)
    {
        var subject = $"Overdue rent — {c.PropertyName} {c.UnitNumber} ({daysOverdue} day{(daysOverdue == 1 ? "" : "s")})";

        var html = Shell(
            "Rent payment overdue", "#dc2626",
            Row("Tenant", E(tenantName)) +
            Row("Property", E(c.PropertyName) + " &middot; " + E(c.UnitNumber)) +
            Row("Contract", E(c.ContractNumber)) +
            Row("Installment", $"{i.InstallmentNumber} of {c.Cheques}") +
            Row("Was due", E(i.DueDate)) +
            Row("Days overdue", daysOverdue.ToString(CultureInfo.InvariantCulture)) +
            Row("Outstanding", Money(i.Balance, currency)),
            Callout($"This payment was due on {i.DueDate} and has not been received. Please settle it as soon as possible.",
                "#fef2f2", "#991b1b"));

        return (subject, html);
    }

    public static (string Subject, string Html) ContractExpiring(
        LeaseContract c, string tenantName, int daysToExpiry, string currency)
    {
        var when = daysToExpiry <= 0 ? "today" : daysToExpiry == 1 ? "tomorrow" : $"in {daysToExpiry} days";
        var subject = $"Lease expires {when} — {c.PropertyName} {c.UnitNumber}";

        var html = Shell(
            "Lease expiry notice", "#d97706",
            Row("Tenant", E(tenantName)) +
            Row("Property", E(c.PropertyName) + " &middot; " + E(c.UnitNumber)) +
            Row("Contract", E(c.ContractNumber)) +
            Row("Term", E(c.StartDate) + " &rarr; " + E(c.EndDate)) +
            Row("Annual rent", Money(c.AnnualRent, currency)) +
            Row("Outstanding balance", Money(c.Balance, currency)),
            Callout($"This lease ends on {c.EndDate}, {when}. Please contact us to arrange renewal or handover.",
                "#fffbeb", "#92400e"));

        return (subject, html);
    }
}
