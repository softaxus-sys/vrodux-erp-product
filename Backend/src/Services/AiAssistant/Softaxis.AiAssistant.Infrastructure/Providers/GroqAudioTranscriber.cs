using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>
/// Transcribes audio (e.g. a Telegram voice note) to text via Groq's Whisper endpoint. Reuses the
/// tenant's Groq API key, so no extra credential is needed when the tenant's provider is Groq.
/// </summary>
public sealed class GroqAudioTranscriber(IHttpClientFactory httpClientFactory, ILogger<GroqAudioTranscriber> logger)
{
    private const string Endpoint = "https://api.groq.com/openai/v1/audio/transcriptions";
    private const string Model    = "whisper-large-v3";

    // Groq validates the upload by filename extension. Telegram voice notes arrive as ".oga",
    // which Groq rejects even though the content is Ogg/Opus — so coerce unknown extensions to ".ogg".
    private static readonly HashSet<string> SupportedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".opus", ".wav", ".webm" };

    /// <summary>Returns the transcribed text, or null on failure.</summary>
    public async Task<string?> TranscribeAsync(string apiKey, byte[] audio, string fileName, CancellationToken ct)
    {
        try
        {
            var ext = System.IO.Path.GetExtension(fileName);
            var safeName = SupportedExtensions.Contains(ext)
                ? fileName
                : System.IO.Path.GetFileNameWithoutExtension(fileName) + ".ogg";

            using var http = httpClientFactory.CreateClient("ai");
            using var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(audio);
            file.Headers.ContentType = new MediaTypeHeaderValue("audio/ogg");
            form.Add(file, "file", safeName);
            form.Add(new StringContent(Model), "model");
            form.Add(new StringContent("text"), "response_format");

            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint) { Content = form };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var res = await http.SendAsync(req, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                logger.LogWarning("Groq Whisper transcription failed: {Status} — {Body}", (int)res.StatusCode, body);
                return null;
            }

            // response_format=text returns the raw transcript; be tolerant if JSON comes back.
            body = body.Trim();
            if (body.StartsWith('{'))
            {
                try
                {
                    using var doc = JsonDocument.Parse(body);
                    if (doc.RootElement.TryGetProperty("text", out var t)) return t.GetString();
                }
                catch { /* fall through */ }
            }
            return string.IsNullOrWhiteSpace(body) ? null : body;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Groq Whisper transcription threw for {FileName}", fileName);
            return null;
        }
    }
}
