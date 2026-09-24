namespace Softaxis.Seo.Infrastructure.Google;

/// <summary>
/// Bound from the "Google" config section — one app registration, shared by the Search Console +
/// Analytics OAuth flow (both scopes requested in one consent screen, so the wizard needs only one
/// "Connect Google" step). Mirrors CRM's MetaOptions. Set via Google__ClientId/Google__ClientSecret
/// env vars on the deployed environment — never committed.
/// </summary>
public sealed class GoogleOptions
{
    public const string Section = "Google";

    public string ClientId     { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string Scopes       { get; set; } =
        "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly";
}
