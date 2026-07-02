using System.Net.Http.Headers;
using System.Text.Json;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>
/// Transcribes audio (e.g. a Telegram voice note) to text via Groq's Whisper endpoint. Reuses the
/// tenant's Groq API key, so no extra credential is needed when the tenant's provider is Groq.
/// </summary>
public sealed class GroqAudioTranscriber(IHttpClientFactory httpClientFactory)
{
    private const string Endpoint = "https://api.groq.com/openai/v1/audio/transcriptions";
    private const string Model    = "whisper-large-v3";

    /// <summary>Returns the transcribed text, or null on failure.</summary>
    public async Task<string?> TranscribeAsync(string apiKey, byte[] audio, string fileName, CancellationToken ct)
    {
        try
        {
            using var http = httpClientFactory.CreateClient("ai");
            using var form = new MultipartFormDataContent();
            var file = new ByteArrayContent(audio);
            file.Headers.ContentType = new MediaTypeHeaderValue("audio/ogg");
            form.Add(file, "file", fileName);
            form.Add(new StringContent(Model), "model");
            form.Add(new StringContent("text"), "response_format");

            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint) { Content = form };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var res = await http.SendAsync(req, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode) return null;

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
        catch
        {
            return null;
        }
    }
}
