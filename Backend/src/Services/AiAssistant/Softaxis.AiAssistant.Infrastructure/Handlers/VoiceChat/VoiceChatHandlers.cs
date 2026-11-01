using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.VoiceChat;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Providers;
using Softaxis.AiAssistant.Infrastructure.VoiceChat;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.VoiceChat;

internal sealed class GetVoiceChatStatusHandler(AiAssistantDbContext db, VoiceAccessResolver access)
    : IQueryHandler<GetVoiceChatStatusQuery, VoiceChatStatusDto>
{
    public async Task<Result<VoiceChatStatusDto>> Handle(GetVoiceChatStatusQuery q, CancellationToken ct)
    {
        var (a, _) = await access.ResolveAsync(ct);
        if (a is null)
        {
            // Over the allowance still counts as "the platform voice exists": report the numbers so the UI can explain.
            var p = await db.PlatformAi.AsNoTracking().FirstOrDefaultAsync(x => x.VoiceEnabled, ct);
            return new VoiceChatStatusDto(false, p is not null, 0, p?.VoiceMonthlyCapPerTenant ?? 0, null);
        }

        var used = a.UsingPlatform ? a.Usage?.VoiceTurns ?? 0 : 0;
        var ready = !string.IsNullOrEmpty(a.SttModel) && !string.IsNullOrEmpty(a.TtsModel);
        return new VoiceChatStatusDto(ready, a.UsingPlatform, used, a.Cap, a.Voice);
    }
}

internal sealed class TranscribeSpeechHandler(VoiceAccessResolver access, OpenRouterSpeechClient speech, Microsoft.Extensions.Logging.ILogger<TranscribeSpeechHandler> log)
    : ICommandHandler<TranscribeSpeechCommand, TranscriptDto>
{
    public async Task<Result<TranscriptDto>> Handle(TranscribeSpeechCommand cmd, CancellationToken ct)
    {
        var (a, problem) = await access.ResolveAsync(ct);
        if (a is null) return Result.Failure<TranscriptDto>(Error.Custom("Voice.Conflict", problem!));
        if (string.IsNullOrEmpty(a.SttModel))
            return Result.Failure<TranscriptDto>(Error.Custom("Voice.Conflict", "No speech-to-text model is set. Ask your administrator."));

        try
        {
            var text = await speech.TranscribeAsync(a.ApiKey, a.SttModel, cmd.AudioBase64, cmd.Format.ToLowerInvariant(), cmd.Language, ct);
            await access.RecordAsync(a, ct);
            return new TranscriptDto(text);
        }
        catch (AiProviderException ex)
        {
            return Result.Failure<TranscriptDto>(Error.Custom("Voice.Unavailable", Friendly(ex, a.UsingPlatform)));
        }
    }

    internal static string Friendly(AiProviderException ex, bool shared) =>
        shared ? "The shared voice is not answering right now. Try again in a moment, or type your question."
               : $"Your voice provider refused the request. {ex.Message}";
}

internal sealed class SynthesizeSpeechHandler(VoiceAccessResolver access, OpenRouterSpeechClient speech, Microsoft.Extensions.Logging.ILogger<SynthesizeSpeechHandler> log)
    : ICommandHandler<SynthesizeSpeechCommand, SpeechDto>
{
    public async Task<Result<SpeechDto>> Handle(SynthesizeSpeechCommand cmd, CancellationToken ct)
    {
        var (a, problem) = await access.ResolveAsync(ct);
        if (a is null) return Result.Failure<SpeechDto>(Error.Custom("Voice.Conflict", problem!));
        if (string.IsNullOrEmpty(a.TtsModel))
            return Result.Failure<SpeechDto>(Error.Custom("Voice.Conflict", "No text-to-speech model is set. Ask your administrator."));

        try
        {
            var (audio, type) = await speech.SynthesizeAsync(a.ApiKey, a.TtsModel, cmd.Text, a.Voice, ct);
            await access.RecordAsync(a, ct);
            return new SpeechDto(audio, type);
        }
        catch (AiProviderException ex)
        {
            return Result.Failure<SpeechDto>(Error.Custom("Voice.Unavailable", TranscribeSpeechHandler.Friendly(ex, a.UsingPlatform)));
        }
    }
}
