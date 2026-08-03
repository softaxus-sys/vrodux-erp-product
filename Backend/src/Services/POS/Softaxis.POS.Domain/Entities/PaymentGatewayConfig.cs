using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// One row per tenant — the tenant's selected online payment gateway and encrypted credentials.
/// "manual" (the default, always available) means no online gateway is wired up: card/cash payments
/// go through a physical terminal exactly as they do today, unaffected by this config. Selecting a
/// real provider (stripe/paytabs/telr/network_international) only stores the credentials at this
/// stage — live charge processing is a follow-up once a specific gateway partnership needs it (same
/// "config layer is real, live adapter is a flagged follow-up" pattern as VisaServices' government
/// channels, Module 15).
/// </summary>
public sealed class PaymentGatewayConfig : AuditableEntity<Guid>
{
    public string Provider { get; private set; } = "manual";
    public string? ApiKeyEncrypted { get; private set; }
    public string? SecretKeyEncrypted { get; private set; }
    /// <summary>Not secret — safe to store/return in plain text (e.g. a Stripe publishable key).</summary>
    public string? PublicKey { get; private set; }
    public string Mode { get; private set; } = "test"; // test/live
    public bool IsEnabled { get; private set; }

    private PaymentGatewayConfig() { }

    public static PaymentGatewayConfig CreateDefault() => new()
    {
        Id = Guid.NewGuid(), Provider = "manual", Mode = "test", IsEnabled = true,
    };

    public void Configure(string provider, string? apiKeyEncrypted, string? secretKeyEncrypted, string? publicKey, string mode, bool isEnabled)
    {
        Provider = provider;
        ApiKeyEncrypted = apiKeyEncrypted;
        SecretKeyEncrypted = secretKeyEncrypted;
        PublicKey = publicKey;
        Mode = mode;
        IsEnabled = isEnabled;
    }
}
