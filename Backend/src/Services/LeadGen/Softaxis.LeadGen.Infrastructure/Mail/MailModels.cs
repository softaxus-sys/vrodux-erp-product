namespace Softaxis.LeadGen.Infrastructure.Mail;

/// <summary>Everything needed to talk to one mailbox, with secrets already decrypted and tokens fresh.</summary>
public sealed record MailCredentials(
    Guid MailboxId, string Provider, string Address, string? DisplayName,
    string? AccessToken, string? Password, string? Username,
    string? SmtpHost, int? SmtpPort, string? ImapHost, int? ImapPort);

public sealed record OutgoingEmail(
    string FromAddress, string? FromName, string To, string? Cc, string Subject, string BodyText, string BodyHtml,
    string MessageId, string? InReplyTo, IReadOnlyList<string> References,
    string? ListUnsubscribeUrl, string? ProviderThreadId, string? ReplyToProviderMessageId);

public sealed record SentEmail(string? ProviderMessageId, string? ProviderThreadId, string? MessageIdHeader, DateTime SentAt);

public sealed record IncomingEmail(
    string ProviderMessageId, string? ProviderThreadId, string? MessageId, string? InReplyTo, IReadOnlyList<string> References,
    string From, string? FromName, string To, string? Cc, string Subject, string? BodyText, DateTime ReceivedAt,
    bool IsBounce, string? BounceRecipient, string? BounceReason, bool IsAutoReply);

public sealed record FetchResult(IReadOnlyList<IncomingEmail> Messages, string? NewCursor);

/// <summary>A mail provider refused our credentials. Only the user can fix it, by reconnecting.</summary>
public sealed class MailAuthException(string message) : Exception(message);

/// <summary>The provider could not be reached or answered with a temporary error. Worth retrying later.</summary>
public sealed class MailTransientException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>The provider rejected this message (bad recipient, blocked content). Retrying will not help.</summary>
public sealed class MailRejectedException(string message) : Exception(message);

/// <summary>One way of sending and reading mail: Gmail, Microsoft 365 or plain SMTP/IMAP.</summary>
public interface IMailTransport
{
    string Provider { get; }
    Task<SentEmail> SendAsync(MailCredentials creds, OutgoingEmail mail, CancellationToken ct);
    Task<FetchResult> FetchAsync(MailCredentials creds, string? cursor, DateTime sinceUtc, CancellationToken ct);
}

public interface IMailTransportFactory
{
    IMailTransport For(string provider);
}
