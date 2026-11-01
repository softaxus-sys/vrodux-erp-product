using FluentValidation;
using Softaxis.AiAssistant.Application.PlatformAi.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.PlatformAi.Commands;

/// <summary>Saves the platform AI. A null key leaves the stored one alone; the Clear flags remove it.</summary>
public sealed record UpdatePlatformAiCommand(
    bool Enabled,
    string Provider,
    string? Model,
    string? ApiKey,
    bool ClearApiKey,
    int MonthlyMessageCapPerTenant,
    int NudgeEveryMessages,
    bool ShowOwnKeyBanner,
    bool VoiceEnabled,
    string? SttModel,
    string? TtsModel,
    string? TtsVoice,
    int VoiceMonthlyCapPerTenant,
    string? VoiceApiKey,
    bool ClearVoiceApiKey) : ICommand<PlatformAiDto>;

public sealed class UpdatePlatformAiCommandValidator : AbstractValidator<UpdatePlatformAiCommand>
{
    public UpdatePlatformAiCommandValidator()
    {
        RuleFor(x => x.Provider).NotEmpty();
        RuleFor(x => x.Model).MaximumLength(160);
        RuleFor(x => x.SttModel).MaximumLength(160);
        RuleFor(x => x.TtsModel).MaximumLength(160);
        RuleFor(x => x.TtsVoice).MaximumLength(60);
        RuleFor(x => x.MonthlyMessageCapPerTenant).InclusiveBetween(0, 1_000_000);
        RuleFor(x => x.NudgeEveryMessages).InclusiveBetween(0, 1000);
        RuleFor(x => x.VoiceMonthlyCapPerTenant).InclusiveBetween(0, 1_000_000);
    }
}

/// <summary>Sends one tiny message through the saved platform text model to prove the key and model work.</summary>
public sealed record TestPlatformAiCommand : ICommand<PlatformAiTestResultDto>;
