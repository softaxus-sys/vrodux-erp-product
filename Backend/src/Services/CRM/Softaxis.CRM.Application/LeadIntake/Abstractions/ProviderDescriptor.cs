namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// Static, code-owned metadata about a lead provider. Drives the Settings → Integrations
/// catalog (card title, description, category) and tells the UI which connect flow to show
/// via <see cref="Capabilities"/>. A provider that is registered but not yet functional sets
/// <see cref="ComingSoon"/> = true.
/// </summary>
public sealed record ProviderDescriptor(
    string Key,
    string DisplayName,
    string Category,
    string Description,
    ProviderCapabilities Capabilities,
    bool ComingSoon = false);

/// <summary>What a provider supports — the UI and pipeline branch on these flags.</summary>
[Flags]
public enum ProviderCapabilities
{
    None        = 0,
    OAuth       = 1 << 0,  // connect via OAuth redirect (Meta, Google, LinkedIn…)
    Webhook     = 1 << 1,  // receives pushed payloads at an inbound URL
    PollSync    = 1 << 2,  // background job pulls leads on a schedule
    ApiKey      = 1 << 3,  // connect by entering an API key / token
    InboundKey  = 1 << 4,  // exposes a per-integration inbound URL + secret (webhook/custom API/website)
    ManualImport = 1 << 5, // CSV / file upload
}

/// <summary>Common provider category labels for grouping in the catalog.</summary>
public static class ProviderCategory
{
    public const string SocialAds   = "Social & Ads";
    public const string Forms       = "Forms";
    public const string Automation  = "Automation";
    public const string Messaging   = "Messaging";
    public const string Website     = "Website";
    public const string Import      = "Import";
    public const string Custom      = "Custom";
}
