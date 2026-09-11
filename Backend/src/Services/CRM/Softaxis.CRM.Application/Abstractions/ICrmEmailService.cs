namespace Softaxis.CRM.Application.Abstractions;

/// <summary>
/// CRM's own small email abstraction — this codebase's convention is one email interface per service
/// (Identity, Restaurant, Real Estate, Finance) rather than a shared cross-service one.
/// </summary>
public interface ICrmEmailService
{
    /// <returns>true only if the message was actually handed to the SMTP server; false when SMTP is
    /// unconfigured or the send failed, so callers never report a delivery that did not happen.</returns>
    Task<bool> SendAsync(string toEmail, string toName, string subject, string html, CancellationToken ct = default);
}
