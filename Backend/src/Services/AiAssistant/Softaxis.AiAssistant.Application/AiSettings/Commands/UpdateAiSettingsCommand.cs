using FluentValidation;
using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.AiSettings.Commands;

/// <summary>
/// Updates the current tenant's AI settings. <see cref="ApiKey"/> is optional: null leaves the
/// stored key untouched; a non-empty value replaces it; set <see cref="ClearApiKey"/> to remove it.
/// </summary>
public sealed record UpdateAiSettingsCommand(
    string Provider,
    string? Model,
    string Tier,
    bool Enabled,
    bool VoiceEnabled,
    bool TelegramEnabled,
    string? ApiKey,
    bool ClearApiKey,
    string? TelegramBotToken = null,
    string? TelegramBotUsername = null,
    bool ClearTelegramBot = false,
    // Fallback provider — null/empty FallbackProvider = feature off (BYO, tenant's own second key).
    string? FallbackProvider = null,
    string? FallbackModel = null,
    string? FallbackApiKey = null,
    bool ClearFallbackApiKey = false) : ICommand<AiSettingsDto>;

public sealed class UpdateAiSettingsCommandValidator : AbstractValidator<UpdateAiSettingsCommand>
{
    private static readonly string[] Providers = ["Claude", "GroqFree", "GroqPaid", "OpenRouter"];
    private static readonly string[] Tiers     = ["starter", "growth", "enterprise"];

    public UpdateAiSettingsCommandValidator()
    {
        RuleFor(x => x.Provider)
            .Must(p => Providers.Contains(p, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Provider must be one of: Claude, GroqFree, GroqPaid, OpenRouter.");

        RuleFor(x => x.Tier)
            .Must(t => Tiers.Contains(t, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Tier must be one of: starter, growth, enterprise.");

        RuleFor(x => x.Model).MaximumLength(120);
        RuleFor(x => x.ApiKey).MaximumLength(400);

        RuleFor(x => x.FallbackProvider)
            .Must(p => string.IsNullOrWhiteSpace(p) || Providers.Contains(p, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Fallback provider must be one of: Claude, GroqFree, GroqPaid, OpenRouter.");
        RuleFor(x => x.FallbackModel).MaximumLength(120);
        RuleFor(x => x.FallbackApiKey).MaximumLength(400);
    }
}
