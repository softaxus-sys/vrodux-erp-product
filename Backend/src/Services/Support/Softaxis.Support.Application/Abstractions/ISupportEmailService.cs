namespace Softaxis.Support.Application.Abstractions;

/// <summary>
/// Sends ticket-confirmation and reply notifications. Support's own small abstraction — this
/// codebase's convention is one email interface per service (Identity, Restaurant, Real Estate)
/// rather than a shared cross-service one.
/// </summary>
public interface ISupportEmailService
{
    /// <returns>true only if the message was actually handed to the SMTP server. False when SMTP
    /// is unconfigured (dev), so the caller can record the attempt honestly instead of logging a
    /// send that never happened.</returns>
    Task<bool> SendAsync(string toEmail, string toName, string subject, string html,
        CancellationToken ct = default);
}
