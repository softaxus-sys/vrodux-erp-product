namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>Sends a paid-order receipt by email. Restaurant's own small abstraction — this codebase's
/// convention is one IEmailService-shaped interface per service rather than a shared cross-service one
/// (each service already does this for ICurrentUser, etc.), so this doesn't reach into Identity's.</summary>
public interface IReceiptEmailService
{
    Task<bool> SendReceiptAsync(string toEmail, string toName, string orderNumber, string receiptHtml, CancellationToken ct = default);
}
