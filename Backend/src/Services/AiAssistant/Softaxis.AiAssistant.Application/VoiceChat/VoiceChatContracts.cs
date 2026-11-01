using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.VoiceChat;

/// <summary>Whether talking to the assistant through the server is possible right now, and how much is left.</summary>
/// <param name="Available">Speech in and out can be served for this workspace.</param>
/// <param name="UsingPlatform">The shared platform voice is answering (not the workspace's own key).</param>
/// <param name="RequestsUsed">Voice requests used this month on the shared voice.</param>
/// <param name="RequestCap">Monthly allowance on the shared voice. 0 = unlimited.</param>
public sealed record VoiceChatStatusDto(bool Available, bool UsingPlatform, int RequestsUsed, int RequestCap, string? Voice);

public sealed record TranscriptDto(string Text);

public sealed record SpeechDto(byte[] Audio, string ContentType);

public sealed record GetVoiceChatStatusQuery : IQuery<VoiceChatStatusDto>;

/// <summary>Turns a recording into text. <see cref="AudioBase64"/> is the raw recording, <see cref="Format"/> its container (webm, ogg, wav, mp3…).</summary>
public sealed record TranscribeSpeechCommand(string AudioBase64, string Format, string? Language) : ICommand<TranscriptDto>;

/// <summary>Reads a reply aloud.</summary>
public sealed record SynthesizeSpeechCommand(string Text) : ICommand<SpeechDto>;

public sealed class TranscribeSpeechCommandValidator : AbstractValidator<TranscribeSpeechCommand>
{
    /// <summary>About 8 MB of audio once decoded; a spoken question is a few hundred KB.</summary>
    public const int MaxBase64Length = 11_000_000;

    public TranscribeSpeechCommandValidator()
    {
        RuleFor(x => x.AudioBase64).NotEmpty().MaximumLength(MaxBase64Length).WithMessage("The recording is too long. Keep it under a minute.");
        RuleFor(x => x.Format).NotEmpty().MaximumLength(10).Matches("^[a-z0-9]+$").WithMessage("Unknown audio format.");
        RuleFor(x => x.Language).MaximumLength(10);
    }
}

public sealed class SynthesizeSpeechCommandValidator : AbstractValidator<SynthesizeSpeechCommand>
{
    public SynthesizeSpeechCommandValidator()
    {
        RuleFor(x => x.Text).NotEmpty().MaximumLength(2500).WithMessage("That reply is too long to read aloud.");
    }
}
