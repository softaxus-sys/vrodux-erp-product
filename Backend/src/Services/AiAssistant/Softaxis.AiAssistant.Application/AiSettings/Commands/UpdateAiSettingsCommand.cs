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
    bool ClearApiKey) : ICommand<AiSettingsDto>;

public sealed class UpdateAiSettingsCommandValidator : AbstractValidator<UpdateAiSettingsCommand>
{
    private static readonly string[] Providers = ["Claude", "GroqFree", "GroqPaid"];
    private static readonly string[] Tiers     = ["starter", "growth", "enterprise"];

    public UpdateAiSettingsCommandValidator()
    {
        RuleFor(x => x.Provider)
            .Must(p => Providers.Contains(p, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Provider must be one of: Claude, GroqFree, GroqPaid.");

        RuleFor(x => x.Tier)
            .Must(t => Tiers.Contains(t, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Tier must be one of: starter, growth, enterprise.");

        RuleFor(x => x.Model).MaximumLength(120);
        RuleFor(x => x.ApiKey).MaximumLength(400);
    }
}
