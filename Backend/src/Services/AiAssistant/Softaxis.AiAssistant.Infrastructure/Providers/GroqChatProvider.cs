using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>
/// Groq provider — OpenAI-compatible Chat Completions endpoint (open models: Llama, Qwen, …).
/// The free and paid tiers share this implementation; they differ only by the tenant's key/model.
/// </summary>
public sealed class GroqChatProvider : IAiChatProvider
{
    private const string Endpoint  = "https://api.groq.com/openai/v1/chat/completions";
    private const int    MaxTokens = 4096;

    private readonly IHttpClientFactory _httpClientFactory;
    public AiProvider Provider { get; }

    public GroqChatProvider(IHttpClientFactory httpClientFactory, AiProvider provider)
    {
        _httpClientFactory = httpClientFactory;
        Provider = provider; // GroqFree or GroqPaid
    }

    public async Task<AiCompletionResult> CompleteAsync(AiCompletionRequest request, CancellationToken ct)
    {
        var messages = new JsonArray
        {
            new JsonObject { ["role"] = "system", ["content"] = request.SystemPrompt },
        };
        foreach (var node in BuildMessages(request.Messages))
            messages.Add(node);

        var body = new JsonObject
        {
            ["model"]      = request.Model,
            ["max_tokens"] = MaxTokens,
            ["messages"]   = messages,
        };

        if (request.Tools.Count > 0)
        {
            body["tools"]       = BuildTools(request.Tools);
            body["tool_choice"] = "auto";
        }

        using var http = _httpClientFactory.CreateClient("ai");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ApiKey);

        using var response = await http.SendAsync(httpRequest, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new AiProviderException($"Groq API error ({(int)response.StatusCode}): {Truncate(payload)}");

        return ParseResponse(payload);
    }

    private static IEnumerable<JsonNode> BuildMessages(IReadOnlyList<AiChatMessage> messages)
    {
        foreach (var m in messages)
        {
            switch (m.Role)
            {
                case AiRole.User:
                    yield return new JsonObject { ["role"] = "user", ["content"] = m.Content ?? string.Empty };
                    break;

                case AiRole.Assistant when m.ToolCalls is { Count: > 0 }:
                {
                    var calls = new JsonArray();
                    foreach (var tc in m.ToolCalls)
                        calls.Add(new JsonObject
                        {
                            ["id"]       = tc.Id,
                            ["type"]     = "function",
                            ["function"] = new JsonObject
                            {
                                ["name"]      = tc.Name,
                                ["arguments"] = string.IsNullOrWhiteSpace(tc.ArgumentsJson) ? "{}" : tc.ArgumentsJson,
                            },
                        });
                    yield return new JsonObject { ["role"] = "assistant", ["content"] = null, ["tool_calls"] = calls };
                    break;
                }

                case AiRole.Assistant:
                    yield return new JsonObject { ["role"] = "assistant", ["content"] = m.Content ?? string.Empty };
                    break;

                case AiRole.Tool:
                    yield return new JsonObject
                    {
                        ["role"]         = "tool",
                        ["tool_call_id"] = m.ToolCallId ?? string.Empty,
                        ["content"]      = m.Content ?? string.Empty,
                    };
                    break;
            }
        }
    }

    private static JsonArray BuildTools(IReadOnlyList<AiToolDefinition> tools)
    {
        var arr = new JsonArray();
        foreach (var t in tools)
            arr.Add(new JsonObject
            {
                ["type"]     = "function",
                ["function"] = new JsonObject
                {
                    ["name"]        = t.Name,
                    ["description"] = t.Description,
                    ["parameters"]  = ParseOrEmptyObject(t.ParametersJsonSchema),
                },
            });
        return arr;
    }

    private static AiCompletionResult ParseResponse(string payload)
    {
        using var doc = JsonDocument.Parse(payload);
        var root = doc.RootElement;

        if (!root.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
            return new AiCompletionResult(null, []);

        var message = choices[0].GetProperty("message");
        string? text = message.TryGetProperty("content", out var c) && c.ValueKind == JsonValueKind.String
            ? c.GetString()
            : null;

        var toolCalls = new List<AiToolCall>();
        if (message.TryGetProperty("tool_calls", out var tcs) && tcs.ValueKind == JsonValueKind.Array)
        {
            foreach (var tc in tcs.EnumerateArray())
            {
                var id = tc.TryGetProperty("id", out var i) ? i.GetString() ?? "" : "";
                var fn = tc.GetProperty("function");
                var name = fn.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                var args = fn.TryGetProperty("arguments", out var a) ? a.GetString() ?? "{}" : "{}";
                toolCalls.Add(new AiToolCall(id, name, args));
            }
        }

        return new AiCompletionResult(string.IsNullOrEmpty(text) ? null : text, toolCalls);
    }

    private static JsonNode ParseOrEmptyObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try { return JsonNode.Parse(json) ?? new JsonObject(); }
        catch { return new JsonObject(); }
    }

    private static string Truncate(string s) => s.Length > 500 ? s[..500] : s;
}
