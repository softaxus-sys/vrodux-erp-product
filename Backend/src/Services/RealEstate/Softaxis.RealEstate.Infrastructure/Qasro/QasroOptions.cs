namespace Softaxis.RealEstate.Infrastructure.Qasro;

/// <summary>
/// Bound from the "Qasro" config section. Real OAuth client credentials — ClientId identifies this
/// Vrodux deployment to Qasro on the authorize URL, ClientSecret authenticates the server-to-server
/// code exchange and pull-key registration. Set via Qasro__ClientId / Qasro__ClientSecret env vars
/// on the deployed environment — never committed. Both products are owned by Softaxis, so there is
/// one fixed client (no per-tenant app registration, no consent-screen review needed on Qasro's
/// side) — but the credential itself is still a real secret, not a public value.
/// </summary>
public sealed class QasroOptions
{
    public const string Section = "Qasro";

    /// <summary>Qasro's site, e.g. https://qasro.com — where the tenant admin is redirected to log in/sign up.</summary>
    public string SiteUrl { get; set; } = "https://qasro.com";

    /// <summary>Qasro's backend base URL for server-to-server calls, e.g. https://api.qasro.com.
    /// Separate from SiteUrl since the two commonly live on different hosts.</summary>
    public string ApiBaseUrl { get; set; } = string.Empty;

    public string ClientId { get; set; } = "vrodux";
    public string ClientSecret { get; set; } = string.Empty;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiBaseUrl) && !string.IsNullOrWhiteSpace(ClientSecret);
}
