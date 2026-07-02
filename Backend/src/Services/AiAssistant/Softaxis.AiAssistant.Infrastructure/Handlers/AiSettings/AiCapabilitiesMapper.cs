using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.AiAssistant.Domain;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.AiSettings;

/// <summary>Builds <see cref="AiCapabilitiesDto"/> from a tenant's settings + the tier matrix.</summary>
internal static class AiCapabilitiesMapper
{
    public static AiCapabilitiesDto From(TenantAiSettings? s)
    {
        var tier = s?.Tier ?? "starter";
        var caps = AiTierCapabilities.For(tier);
        return new AiCapabilitiesDto(
            caps.Tier, caps.Voice, caps.Telegram, caps.Automations, caps.Autopilot, caps.MaxAutomationRules,
            VoiceEnabled:    (s?.VoiceEnabled ?? false) && caps.Voice,
            TelegramEnabled: (s?.TelegramEnabled ?? false) && caps.Telegram,
            AiEnabled:       s?.Enabled ?? false);
    }
}
