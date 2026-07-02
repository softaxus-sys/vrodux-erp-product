using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Infrastructure.Providers;

/// <summary>
/// Anthropic Claude provider (Messages API). Translates the provider-agnostic request into
/// Claude's tool-use wire format and back. Stateless; the tenant's API key is passed per call.
/// </summary>
public sealed class ClaudeChatProvider(IHttpClientFactory httpClientFactory) : IAiChatProvider
{
    private const string Endpoint       = "https://api.anthropic.com/v1/messages";
    private const string AnthropicVersion = "2023-06-01";
    private const int    MaxTokens      = 4096;

    public AiProvider Provider => AiProvider.Claude;

    public async Task<AiCompletionResult> CompleteAsync(AiCompletionRequest request, CancellationToken ct)
    {
        var body = new JsonObject
        {
            ["model"]      = request.Model,
            ["max_tokens"] = MaxTokens,
            ["system"]     = request.SystemPrompt,
            ["messages"]   = BuildMessages(request.Messages),
        };

        if (request.Tools.Count > 0)
            body["tools"] = BuildTools(request.Tools);

        using var http = httpClientFactory.CreateClient("ai");
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        httpRequest.Headers.Add("x-api-key", request.ApiKey);
        httpRequest.Headers.Add("anthropic-version", AnthropicVersion);

        using var response = await http.SendAsync(httpRequest, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new AiProviderException($"Claude API error ({(int)response.StatusCode}): {Truncate(payload)}");

        return ParseResponse(payload);
    }

    private static JsonArray BuildMessages(IReadOnlyList<AiChatMessage> messages)
    {
        var arr = new JsonArray();
        foreach (var m in messages)
        {
            switch (m.Role)
            {
                case AiRole.User:
                    arr.Add(new JsonObject { ["role"] = "user", ["content"] = m.Content ?? string.Empty });
                    break;

                case AiRole.Assistant when m.ToolCalls is { Count: > 0 }:
                {
                    var content = new JsonArray();
                    if (!string.IsNullOrEmpty(m.Content))
                        content.Add(new JsonObject { ["type"] = "text", ["text"] = m.Content });
                    foreach (var tc in m.ToolCalls)
                        content.Add(new JsonObject
                        {
                            ["type"]  = "tool_use",
                            ["id"]    = tc.Id,
                            ["name"]  = tc.Name,
                            ["input"] = ParseOrEmptyObject(tc.ArgumentsJson),
                        });
                    arr.Add(new JsonObject { ["role"] = "assistant", ["content"] = content });
                    break;
                }

                case AiRole.Assistant:
                    arr.Add(new JsonObject { ["role"] = "assistant", ["content"] = m.Content ?? string.Empty });
                    break;

                case AiRole.Tool:
                    arr.Add(new JsonObject
                    {
                        ["role"]    = "user",
                        ["content"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["type"]        = "tool_result",
                                ["tool_use_id"] = m.ToolCallId ?? string.Empty,
                                ["content"]     = m.Content ?? string.Empty,
                            },
                        },
                    });
                    break;
            }
        }
        return arr;
    }

    private static JsonArray BuildTools(IReadOnlyList<AiToolDefinition> tools)
    {
        var arr = new JsonArray();
        foreach (var t in tools)
            arr.Add(new JsonObject
            {
                ["name"]         = t.Name,
                ["description"]  = t.Description,
                ["input_schema"] = ParseOrEmptyObject(t.ParametersJsonSchema),
            });
        return arr;
    }

    private static AiCompletionResult ParseResponse(string payload)
    {
        using var doc = JsonDocument.Parse(payload);
        var root = doc.RootElement;

        var text = new StringBuilder();
        var toolCalls = new List<AiToolCall>();

        if (root.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
        {
            foreach (var block in content.EnumerateArray())
            {
                var type = block.TryGetProperty("type", out var t) ? t.GetString() : null;
                if (type == "text" && block.TryGetProperty("text", out var txt))
                    text.Append(txt.GetString());
                else if (type == "tool_use")
                {
                    var id    = block.TryGetProperty("id", out var i) ? i.GetString() ?? "" : "";
                    var name  = block.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    var input = block.TryGetProperty("input", out var inp) ? inp.GetRawText() : "{}";
                    toolCalls.Add(new AiToolCall(id, name, input));
                }
            }
        }

        var textResult = text.Length > 0 ? text.ToString() : null;
        return new AiCompletionResult(textResult, toolCalls);
    }

    private static JsonNode ParseOrEmptyObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try { return JsonNode.Parse(json) ?? new JsonObject(); }
        catch { return new JsonObject(); }
    }

    private static string Truncate(string s) => s.Length > 500 ? s[..500] : s;
}
