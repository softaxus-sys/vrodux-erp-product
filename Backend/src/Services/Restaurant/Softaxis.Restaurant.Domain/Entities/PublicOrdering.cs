namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>One guest's QR-table ordering visit — correlates repeat orders from the same device/table
/// across a sitting. GuestDeviceToken is a client-generated id (e.g. localStorage uuid), not tied to
/// any account. Purely informational bookkeeping; the anonymous public-orders endpoint works fine
/// without a prior session (StartSessionIfNeeded creates one on first order).</summary>
public sealed class TableOrderingSession
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid TableId { get; private set; }
    public string GuestDeviceToken { get; private set; } = null!;
    public DateTime StartedAt { get; private set; } = DateTime.UtcNow;
    public DateTime LastActivityAt { get; private set; } = DateTime.UtcNow;

    public TableOrderingSession(Guid tableId, string guestDeviceToken)
    {
        TableId = tableId; GuestDeviceToken = guestDeviceToken;
    }

    public void Touch() => LastActivityAt = DateTime.UtcNow;
}

/// <summary>Audit row for a receipt sent to the guest after payment — captures who sent what, where,
/// and whether it succeeded. Actual delivery goes through IReceiptEmailService (email) or
/// IWhatsAppProvider (whatsapp); this table just records the attempt, mirroring the Identity
/// email-verification / password-reset send-log pattern used elsewhere in this codebase.</summary>
public sealed class DigitalReceiptLog
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public string Channel { get; private set; } = null!; // email/whatsapp
    public string RecipientAddress { get; private set; } = null!;
    public DateTime SentAt { get; private set; } = DateTime.UtcNow;
    public string Status { get; private set; } = "sent"; // sent/failed
    public string? ErrorMessage { get; private set; }

    // EF Core materialization ctor — `success` below isn't a 1:1 property (it's transformed into Status).
    private DigitalReceiptLog() { }

    public DigitalReceiptLog(Guid orderId, string channel, string recipientAddress, bool success, string? errorMessage)
    {
        OrderId = orderId; Channel = channel; RecipientAddress = recipientAddress;
        Status = success ? "sent" : "failed"; ErrorMessage = errorMessage;
    }
}
