namespace Softaxis.AiAssistant.Domain;

/// <summary>
/// What each plan tier unlocks for the AI assistant. This is the single source of truth for
/// feature gating — the settings handler, the automation handlers, and the runtime scheduler all
/// consult <see cref="For"/> so a tenant can never use (or keep running) a feature above its tier.
///
/// <para>Tiers: <b>starter</b> = chat only; <b>growth</b> = + Telegram, voice, and confirm-mode
/// automations (capped); <b>enterprise</b> = + autopilot automations and unlimited rules.</para>
/// </summary>
public sealed record AiTierCapabilities(
    string Tier,
    bool Voice,
    bool Telegram,
    bool Automations,
    bool Autopilot,
    int MaxAutomationRules) // -1 = unlimited
{
    /// <summary>True when the tier places no limit on the number of automation rules.</summary>
    public bool UnlimitedAutomationRules => MaxAutomationRules < 0;

    public static AiTierCapabilities For(string? tier) => Normalize(tier) switch
    {
        "enterprise" => new("enterprise", Voice: true, Telegram: true, Automations: true, Autopilot: true,  MaxAutomationRules: -1),
        "growth"     => new("growth",     Voice: true, Telegram: true, Automations: true, Autopilot: false, MaxAutomationRules: 20),
        _            => new("starter",    Voice: false, Telegram: false, Automations: false, Autopilot: false, MaxAutomationRules: 0),
    };

    private static string Normalize(string? tier) =>
        string.IsNullOrWhiteSpace(tier) ? "starter" : tier.Trim().ToLowerInvariant();
}
