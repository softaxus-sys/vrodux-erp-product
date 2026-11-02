using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Providers;

namespace Softaxis.AiAssistant.Infrastructure.VoiceChat;

/// <summary>Everything one voice request needs: whose key, which models, and which month's counter to spend.</summary>
public sealed record VoiceAccess(
    string ApiKey, string? SttModel, string? TtsModel, string? Voice,
    bool UsingPlatform, int Cap, PlatformAiUsage? Usage);

/// <summary>
/// Decides who pays for a spoken request. A workspace on OpenRouter with its own key uses it (no
/// allowance from us); everyone else uses the super admin's platform voice, within the monthly
/// allowance. The models and voice always come from the platform settings, so the super admin picks
/// them in one place.
/// </summary>
public sealed class VoiceAccessResolver(AiAssistantDbContext db, ISecretProtector protector)
{
    public async Task<(VoiceAccess? Access, string? Problem)> ResolveAsync(CancellationToken ct)
    {
        var platform = await db.PlatformAi.AsNoTracking().FirstOrDefaultAsync(ct);
        if (platform is null || !platform.VoiceEnabled)
            return (null, "Voice is not switched on for the platform. Ask your administrator.");

        // Their own OpenRouter key: the speech endpoints are OpenRouter's, so it works there and costs us nothing.
        var own = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var ownKey = own is { Enabled: true, Provider: AiProvider.OpenRouter } ? protector.Unprotect(own.ProtectedApiKey) : null;
        if (!string.IsNullOrEmpty(ownKey))
            return (new VoiceAccess(ownKey, platform.SttModel, platform.TtsModel, platform.TtsVoice, false, 0, null), null);

        // Shared voice: a dedicated voice key, or the text key when the platform text provider is OpenRouter.
        var key = protector.Unprotect(platform.ProtectedVoiceApiKey);
        if (string.IsNullOrEmpty(key) && platform.Provider == AiProvider.OpenRouter)
            key = protector.Unprotect(platform.ProtectedApiKey);
        if (string.IsNullOrEmpty(key))
            return (null, "The shared voice has no API key yet. Ask your administrator.");

        var month = DateTime.UtcNow.ToString("yyyy-MM");
        var usage = await db.PlatformUsage.FirstOrDefaultAsync(u => u.Month == month, ct) ?? new PlatformAiUsage(month);
        var cap = platform.VoiceMonthlyCapPerTenant;
        if (cap > 0 && usage.VoiceTurns >= cap)
            return (null, $"Your company has used all {cap} shared voice requests for this month. Add your own OpenRouter key in Settings to keep talking.");

        return (new VoiceAccess(key, platform.SttModel, platform.TtsModel, platform.TtsVoice, true, cap, usage), null);
    }

    /// <summary>Spends one request on the shared voice. Own-key requests are not counted.</summary>
    public async Task RecordAsync(VoiceAccess access, CancellationToken ct)
    {
        if (!access.UsingPlatform || access.Usage is null) return;
        if (db.Entry(access.Usage).State == EntityState.Detached) db.PlatformUsage.Add(access.Usage);
        access.Usage.AddVoiceTurn();
        await db.SaveChangesAsync(ct);
    }
}

/// <summary>OpenRouter's dedicated audio endpoints (announced 2026-05): speech to text and text to speech.</summary>
public sealed class OpenRouterSpeechClient(IHttpClientFactory httpClientFactory)
{
    private const string Base = "https://openrouter.ai/api/v1";

    public async Task<string> TranscribeAsync(string apiKey, string model, string audioBase64, string format, string? language, CancellationToken ct)
    {
        var body = new Dictionary<string, object?>
        {
            ["model"] = model,
            ["input_audio"] = new { data = audioBase64, format },
        };
        if (!string.IsNullOrWhiteSpace(language)) body["language"] = language;

        using var res = await SendAsync(apiKey, $"{Base}/audio/transcriptions", body, ct);
        var json = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode) throw Failure("OpenRouter transcription", res, json);

        using var doc = JsonDocument.Parse(json);
        foreach (var name in new[] { "text", "transcript" })
            if (doc.RootElement.TryGetProperty(name, out var t) && t.ValueKind == JsonValueKind.String)
                return t.GetString()!.Trim();
        throw new AiProviderException("OpenRouter transcription returned no text.", (int)res.StatusCode);
    }

    public async Task<(byte[] Audio, string ContentType)> SynthesizeAsync(string apiKey, string model, string text, string? voice, CancellationToken ct)
    {
        var body = new Dictionary<string, object?>
        {
            ["model"] = model,
            ["input"] = text,
            ["response_format"] = "mp3",
        };
        // A voice is optional on some models; sending none lets the provider choose its default.
        if (!string.IsNullOrWhiteSpace(voice)) body["voice"] = voice;

        using var res = await SendAsync(apiKey, $"{Base}/audio/speech", body, ct);
        if (!res.IsSuccessStatusCode) throw Failure("OpenRouter speech", res, await res.Content.ReadAsStringAsync(ct));

        var bytes = await res.Content.ReadAsByteArrayAsync(ct);
        if (bytes.Length == 0) throw new AiProviderException("OpenRouter speech returned no audio.", (int)res.StatusCode);
        return (bytes, res.Content.Headers.ContentType?.MediaType ?? "audio/mpeg");
    }

    private async Task<HttpResponseMessage> SendAsync(string apiKey, string url, object body, CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient("ai");
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        return await http.SendAsync(req, ct);
    }

    private static AiProviderException Failure(string what, HttpResponseMessage res, string body)
    {
        var snippet = body.Length > 300 ? body[..300] : body;
        return new AiProviderException($"{what} failed ({(int)res.StatusCode}): {snippet}", (int)res.StatusCode);
    }
}
