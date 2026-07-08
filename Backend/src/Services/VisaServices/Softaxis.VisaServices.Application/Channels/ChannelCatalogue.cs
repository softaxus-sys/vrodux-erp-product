namespace Softaxis.VisaServices.Application.Channels;

/// <summary>
/// Declarative registry of government submission channels — the plug-in extension point.
/// A live adapter is added by (1) appending a descriptor here with Status="active", and
/// (2) a handler that reads the tenant's ChannelAccount and writes GovtSubmission rows.
/// UAE has no open self-serve visa APIs, so only "manual" is active today; UAE PASS is the
/// most realistic first real integration (it has an actual developer program).
/// </summary>
public sealed record ChannelDescriptor(
    string Key, string Name, string Description, bool RequiresCredentials,
    string Status, string SetupGuide);

public static class ChannelCatalogue
{
    public static readonly IReadOnlyList<ChannelDescriptor> All =
    [
        new("manual", "Manual submission",
            "Your PRO submits on the government portal and records the reference numbers here. Works today, no onboarding.",
            RequiresCredentials: false, Status: "active",
            SetupGuide: "No setup needed. Create a submission on a case and enter the government reference the PRO receives."),
        new("uaepass", "UAE PASS",
            "National digital identity — verify applicants and sign documents. The one UAE channel with a real developer program.",
            RequiresCredentials: true, Status: "beta",
            SetupGuide: "Register your app on the UAE PASS developer portal, then enter your client credentials here. Applicant identity/consent flows land next."),
        new("gdrfa", "GDRFA Dubai (eDNRD)",
            "Dubai entry permits & residence visas. Requires a registered typing centre / Amer licence and GDRFA channel-partner onboarding.",
            RequiresCredentials: true, Status: "coming_soon",
            SetupGuide: "Requires GDRFA channel-partner access. Enter your establishment card + eDNRD credentials once onboarded."),
        new("icp", "ICP eChannels (Federal)",
            "All non-Dubai emirates' visas, Emirates ID and golden visa. Requires ICP establishment onboarding.",
            RequiresCredentials: true, Status: "coming_soon",
            SetupGuide: "Requires an approved ICP eChannels account. Enter your establishment card + user credentials once onboarded."),
        new("mohre", "MOHRE",
            "Work permits, labour cards and quotas via the Tasheel channel.",
            RequiresCredentials: true, Status: "coming_soon",
            SetupGuide: "Requires MOHRE / Tasheel channel access. Enter your establishment credentials once onboarded."),
    ];

    public static ChannelDescriptor? Find(string key) =>
        All.FirstOrDefault(c => string.Equals(c.Key, key, StringComparison.OrdinalIgnoreCase));
}
