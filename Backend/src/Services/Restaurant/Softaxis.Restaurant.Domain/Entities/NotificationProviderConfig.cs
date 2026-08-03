namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// One row per (tenant, channel) — the tenant's SMS or WhatsApp provider credentials for digital
/// receipts (see DigitalReceiptLog / SendReceiptCommand). No DB-level unique constraint on Channel
/// alone — it would wrongly collide across tenants since "sms"/"whatsapp" aren't tenant-specific
/// values; uniqueness per (tenant, channel) is enforced at the application level (see
/// UpsertNotificationProviderConfigHandler), the same way PaymentGatewayConfig's per-tenant
/// singleton is (POS).
/// </summary>
public sealed class NotificationProviderConfig
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Channel { get; private set; } = null!; // "sms" | "whatsapp"
    public string Provider { get; private set; } = "twilio";
    public string? AccountSidEncrypted { get; private set; }
    public string? AuthTokenEncrypted { get; private set; }
    public string? FromNumber { get; private set; }
    public bool IsEnabled { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public NotificationProviderConfig(string channel, string provider)
    {
        Channel = channel;
        Provider = provider;
    }

    public void Configure(string? accountSidEncrypted, string? authTokenEncrypted, string? fromNumber, bool isEnabled)
    {
        AccountSidEncrypted = accountSidEncrypted;
        AuthTokenEncrypted = authTokenEncrypted;
        FromNumber = fromNumber;
        IsEnabled = isEnabled;
        UpdatedAt = DateTime.UtcNow;
    }
}
