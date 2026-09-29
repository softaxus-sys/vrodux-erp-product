namespace Softaxis.RealEstate.Infrastructure.Qasro;

/// <summary>
/// Bound from the "Qasro" config section. One shared service credential, set via
/// Qasro__ServiceSecret env var on the deployed environment — never committed. Both products are
/// owned by Softaxis, so this is a service-to-service secret (like a Telegram bot token), not a
/// per-tenant OAuth client — there is no consent screen because there is no third party.
/// </summary>
public sealed class QasroOptions
{
    public const string Section = "Qasro";

    /// <summary>Qasro's backend base URL, e.g. https://api.qasro.com.</summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>Shared secret proving a call genuinely came from this Vrodux deployment.
    /// Sent as a bearer token, never exposed to any browser.</summary>
    public string ServiceSecret { get; set; } = string.Empty;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BaseUrl) && !string.IsNullOrWhiteSpace(ServiceSecret);
}
