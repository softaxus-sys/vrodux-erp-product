namespace Softaxis.LeadGen.Infrastructure.Options;

/// <summary>
/// Server-side configuration, bound from the "LeadGen" section. Every secret comes from the
/// environment (LeadGen__GooglePlaces__ApiKey …) and is never stored in the database or returned
/// by any endpoint. A missing value never crashes startup — the feature that needs it reports
/// itself as not configured, and the screen says so.
/// </summary>
public sealed class LeadGenOptions
{
    public const string Section = "LeadGen";

    /// <summary>Public origin of the app, used in unsubscribe links and OAuth returns.</summary>
    public string? PublicBaseUrl { get; set; }

    /// <summary>
    /// Public origin of the API, used for the unsubscribe link in every email. In production this is the same
    /// origin as the app (the proxy forwards /api); in development the API runs on its own port.
    /// </summary>
    public string? PublicApiUrl { get; set; }

    public GooglePlacesOptions GooglePlaces { get; set; } = new();
    public EmailVerifierOptions EmailVerifier { get; set; } = new();
    public StripeCheckoutOptions Stripe { get; set; } = new();
    public PayPalCheckoutOptions PayPal { get; set; } = new();
    public MailOAuthOptions Google { get; set; } = new();
    public MailOAuthOptions Microsoft { get; set; } = new();

    /// <summary>When set, outgoing mail is written as .eml files here instead of being sent. For trying the flow without SMTP.</summary>
    public string? PickupDirectory { get; set; }
}

public sealed class GooglePlacesOptions
{
    public string? ApiKey { get; set; }
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}

public sealed class EmailVerifierOptions
{
    /// <summary>"zerobounce" or empty. Empty = syntax, disposable and DNS (MX) checks only.</summary>
    public string? Provider { get; set; }
    public string? ApiKey { get; set; }
    public bool IsConfigured => string.Equals(Provider, "zerobounce", StringComparison.OrdinalIgnoreCase)
                                && !string.IsNullOrWhiteSpace(ApiKey);
}

public sealed class StripeCheckoutOptions
{
    /// <summary>Falls back to Billing:Stripe:SecretKey, so one Stripe account serves both subscriptions and credits.</summary>
    public string? SecretKey { get; set; }
    /// <summary>Signing secret (whsec_…) of the endpoint registered at /api/leadgen/billing/webhook/stripe.</summary>
    public string? WebhookSecret { get; set; }
}

public sealed class PayPalCheckoutOptions
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public bool UseSandbox { get; set; }
}

public sealed class MailOAuthOptions
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    /// <summary>Microsoft only: the Azure tenant, or "common" for any account.</summary>
    public string? Tenant { get; set; } = "common";
    public bool IsConfigured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}
