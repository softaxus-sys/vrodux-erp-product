using FluentValidation;
using Softaxis.AiAssistant.Application.Voice.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Voice.Commands;

/// <summary>
/// Updates the current tenant's voice-agent settings. <see cref="VapiApiKey"/> is optional:
/// null leaves the stored key untouched; a non-empty value replaces it; set
/// <see cref="ClearVapiApiKey"/> to remove it (mirrors the BYO LLM key semantics).
/// </summary>
public sealed record UpdateVoiceSettingsCommand(
    bool Enabled,
    string? VapiApiKey,
    bool ClearVapiApiKey,
    string? VapiPhoneNumberId,
    string? VapiAssistantId,
    Guid RunAsUserId,
    int CallDelayMinutes,
    int MaxAttempts,
    int MonthlyMinutesCap,
    string DefaultLanguage,
    string? AgentName,
    string? CompanyName,
    string? CompanyDescription,
    string? Industry,
    string? Knowledge) : ICommand<VoiceSettingsDto>;

public sealed class UpdateVoiceSettingsCommandValidator : AbstractValidator<UpdateVoiceSettingsCommand>
{
    private static readonly string[] Languages = ["en", "ur", "ar"];

    public UpdateVoiceSettingsCommandValidator()
    {
        RuleFor(x => x.VapiApiKey).MaximumLength(400);
        RuleFor(x => x.VapiPhoneNumberId).MaximumLength(100);
        RuleFor(x => x.VapiAssistantId).MaximumLength(100);
        RuleFor(x => x.CallDelayMinutes).InclusiveBetween(0, 24 * 60);
        RuleFor(x => x.MaxAttempts).InclusiveBetween(1, 10);
        RuleFor(x => x.MonthlyMinutesCap).GreaterThanOrEqualTo(0);
        RuleFor(x => x.DefaultLanguage)
            .Must(l => Languages.Contains(l, StringComparer.OrdinalIgnoreCase))
            .WithMessage("DefaultLanguage must be one of: en, ur, ar.");
        RuleFor(x => x.AgentName).MaximumLength(120);
        RuleFor(x => x.CompanyName).MaximumLength(200);
        RuleFor(x => x.CompanyDescription).MaximumLength(2000);
        RuleFor(x => x.Industry).MaximumLength(120);

        // The agent acts through this user for post-call CRM writes — enabling without one
        // would leave every call unable to update the lead.
        RuleFor(x => x.RunAsUserId)
            .NotEqual(Guid.Empty)
            .When(x => x.Enabled)
            .WithMessage("A run-as user is required to enable the voice agent.");
    }
}
