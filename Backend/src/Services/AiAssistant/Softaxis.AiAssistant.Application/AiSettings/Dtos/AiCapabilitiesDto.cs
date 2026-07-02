namespace Softaxis.AiAssistant.Application.AiSettings.Dtos;

/// <summary>
/// What the current tenant's plan tier unlocks, plus which optional features the admin has actually
/// turned on. Returned to every authenticated user (no secrets) so the UI can show/hide voice, the
/// automations panel, autopilot, etc. Mirrors the domain <c>AiTierCapabilities</c> matrix.
/// </summary>
public sealed record AiCapabilitiesDto(
    string Tier,
    bool Voice,
    bool Telegram,
    bool Automations,
    bool Autopilot,
    int MaxAutomationRules,
    // Feature toggles the admin has enabled (still bounded by the tier flags above).
    bool VoiceEnabled,
    bool TelegramEnabled,
    bool AiEnabled);
