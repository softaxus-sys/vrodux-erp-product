namespace Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;

/// <summary>
/// Meta (Facebook/Instagram) app credentials — the integrator's single app shared by all
/// tenants. Per-tenant page tokens are obtained via OAuth and stored encrypted per integration.
/// Bound from configuration section "Meta" (appsettings / environment).
/// </summary>
public sealed class MetaOptions
{
    public const string Section = "Meta";

    public string AppId        { get; set; } = string.Empty;
    public string AppSecret    { get; set; } = string.Empty;
    /// <summary>Single app-level token echoed back during webhook subscription verification.</summary>
    public string VerifyToken  { get; set; } = string.Empty;
    public string GraphVersion { get; set; } = "v21.0";

    /// <summary>
    /// Graph API version used to send lead-stage events (Conversions API). Kept apart from
    /// <see cref="GraphVersion"/> so the lead-retrieval calls are not changed by it.
    /// </summary>
    public string ConversionsGraphVersion { get; set; } = "v26.0";

    /// <summary>
    /// OAuth scopes requested for Lead Ads retrieval + page management.
    /// pages_manage_ads is required to read a page's leadgen_forms; leads_retrieval to
    /// download the lead data; pages_manage_metadata to subscribe the page to webhooks.
    /// </summary>
    public string Scopes { get; set; } =
        "leads_retrieval,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_manage_ads,business_management";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(AppId) && !string.IsNullOrWhiteSpace(AppSecret);
}
