namespace Softaxis.Finance.Application.Abstractions;

/// <summary>
/// An image embedded in the message body and referenced as <c>cid:{ContentId}</c>.
///
/// Letterhead images are stored as data URIs, and a <c>&lt;img src="data:..."&gt;</c> is stripped by
/// Gmail and blocked by Outlook — the logo, signature and stamp would simply not appear. Embedding
/// them as linked resources is the only way they render in a real inbox.
/// </summary>
public sealed record InlineImage(string ContentId, string DataUri);

/// <summary>
/// A file attached to the message — the invoice PDF.
///
/// Distinct from <see cref="InlineImage"/>: an attachment is meant to be saved and filed by the
/// recipient, not rendered inside the body. Customers file invoices, and many forward them
/// straight to their own accounts payable, so the PDF has to survive as a separate document.
/// </summary>
public sealed record EmailAttachment(string FileName, byte[] Content, string ContentType);

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
        string subject, string html,
        IReadOnlyList<InlineImage>? inlineImages = null,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken ct = default);
}
