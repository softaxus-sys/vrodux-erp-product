namespace Softaxis.RealEstate.Application.Abstractions;

/// <summary>
/// Sends rent and lease-expiry notices. Real Estate's own small abstraction — this codebase's
/// convention is one email interface per service (Identity, Restaurant) rather than a shared
/// cross-service one, so this does not reach into Identity's.
/// </summary>
public interface IRealEstateEmailService
{
    /// <returns>true only if the message was actually handed to the SMTP server. False when SMTP
    /// is unconfigured (dev), so the caller can record the attempt honestly instead of logging a
    /// send that never happened.</returns>
    Task<bool> SendAsync(string toEmail, string toName, IReadOnlyList<string> cc,
        string subject, string html, CancellationToken ct = default);
}
