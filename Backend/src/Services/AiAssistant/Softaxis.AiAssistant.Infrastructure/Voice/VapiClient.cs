using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Softaxis.AiAssistant.Infrastructure.Voice;

/// <summary>
/// Thin HTTP wrapper over the Vapi API (https://api.vapi.ai) using the tenant's own key — the
/// tenant pays for its call minutes (BYO, like the LLM keys). Kept deliberately small and
/// vendor-shaped so a Retell adapter could replace it without touching the scheduler/worker.
/// </summary>
public sealed class VapiClient(IHttpClientFactory httpClientFactory, IConfiguration configuration)
{
    private const string BaseUrl = "https://api.vapi.ai";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Places an outbound call. When <see cref="VapiOutboundCallRequest.AssistantId"/> is set, the
    /// call runs the tenant's own dashboard-built assistant (its prompt/voice/transcriber apply) with
    /// per-lead <c>variableValues</c> injected for <c>{{leadName}}</c>-style templates; otherwise a
    /// transient assistant is generated from the persona settings. Returns the Vapi call id.
    /// </summary>
    public async Task<VapiCall> CreateOutboundCallAsync(string apiKey, VapiOutboundCallRequest req, CancellationToken ct)
    {
        object payload = !string.IsNullOrEmpty(req.AssistantId)
            ? new
            {
                phoneNumberId = req.PhoneNumberId,
                customer = new { number = req.CustomerNumber, name = NullIfEmpty(req.CustomerName) },
                assistantId = req.AssistantId,
                // Keep the assistant's own prompt/voice; only inject the per-lead variables and
                // route this call's events to our webhook.
                assistantOverrides = new
                {
                    variableValues = req.Variables,
                    maxDurationSeconds = req.MaxDurationSeconds,
                    server = new { url = req.ServerUrl, secret = req.ServerSecret },
                    serverMessages = new[] { "end-of-call-report", "status-update" },
                },
            }
            : BuildTransientPayload(req);

        var body = await SendAsync(apiKey, HttpMethod.Post, "/call", JsonSerializer.Serialize(payload, Json), ct);
        return Parse(body);
    }

    private object BuildTransientPayload(VapiOutboundCallRequest req)
    {
        // Model the transient assistant runs on — billed to the tenant's Vapi account. Config-overridable.
        var modelProvider = configuration["Ai:Voice:ModelProvider"] ?? "openai";
        var model         = configuration["Ai:Voice:Model"] ?? "gpt-4o-mini";
        var voiceProvider = configuration["Ai:Voice:VoiceProvider"];
        var voiceId       = configuration["Ai:Voice:VoiceId"];

        return new
        {
            phoneNumberId = req.PhoneNumberId,
            customer = new { number = req.CustomerNumber, name = NullIfEmpty(req.CustomerName) },
            assistant = new
            {
                name = "Vrodux Voice Agent",
                firstMessage = req.FirstMessage,
                model = new
                {
                    provider = modelProvider,
                    model,
                    messages = new[] { new { role = "system", content = req.SystemPrompt } },
                },
                // Only pin a voice when explicitly configured; otherwise Vapi's default applies.
                voice = string.IsNullOrEmpty(voiceProvider) || string.IsNullOrEmpty(voiceId)
                    ? null
                    : new { provider = voiceProvider, voiceId },
                maxDurationSeconds = req.MaxDurationSeconds,
                server = new { url = req.ServerUrl, secret = req.ServerSecret },
                serverMessages = new[] { "end-of-call-report", "status-update" },
            },
        };
    }

    public async Task<VapiCall> GetCallAsync(string apiKey, string callId, CancellationToken ct)
    {
        var body = await SendAsync(apiKey, HttpMethod.Get, $"/call/{Uri.EscapeDataString(callId)}", null, ct);
        return Parse(body);
    }

    private async Task<string> SendAsync(string apiKey, HttpMethod method, string path, string? jsonBody, CancellationToken ct)
    {
        using var http = httpClientFactory.CreateClient("ai");
        using var request = new HttpRequestMessage(method, BaseUrl + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (jsonBody is not null)
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

        using var response = await http.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new VapiApiException((int)response.StatusCode, Truncate(body));
        return body;
    }

    private static VapiCall Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var id = root.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
        if (string.IsNullOrEmpty(id))
            throw new VapiApiException(200, "Vapi response had no call id: " + Truncate(json));
        var status = root.TryGetProperty("status", out var stEl) ? stEl.GetString() : null;
        return new VapiCall(id, status ?? "queued");
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;
    private static string Truncate(string s) => s.Length <= 600 ? s : s[..600] + "…";
}

public sealed record VapiCall(string Id, string Status);

public sealed record VapiOutboundCallRequest(
    string PhoneNumberId,
    string CustomerNumber,
    string? CustomerName,
    string SystemPrompt,
    string FirstMessage,
    string ServerUrl,
    string ServerSecret,
    int MaxDurationSeconds = 600,
    /// <summary>When set, the call uses this dashboard-built assistant instead of a transient one.</summary>
    string? AssistantId = null,
    /// <summary>Per-lead template values ({{leadName}}, {{companyName}}, …) for the persistent assistant.</summary>
    IReadOnlyDictionary<string, string>? Variables = null);

/// <summary>Raised when Vapi rejects a request; the worker records it on the call row.</summary>
public sealed class VapiApiException(int statusCode, string body)
    : Exception($"Vapi API error (HTTP {statusCode}): {body}")
{
    public int StatusCode { get; } = statusCode;
}
