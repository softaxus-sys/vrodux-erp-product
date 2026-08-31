namespace Softaxis.Finance.Application.Abstractions;

/// <summary>
/// Sends invoices to customers. Finance's own small abstraction — this codebase's convention is
/// one email interface per service (Identity, Restaurant, Real Estate) rather than a shared one.
/// </summary>
public interface IFinanceEmailService
{
    /// <returns>true only if the mail server accepted the message. False when SMTP is
    /// unconfigured, so the caller records the attempt honestly instead of marking an invoice
    /// "sent" that nobody received.</returns>
    Task<bool> SendInvoiceAsync(string toEmail, string toName, IReadOnlyList<string> cc,
        string subject, string html, CancellationToken ct = default);
}
