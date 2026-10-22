using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.Messaging.Application.Abstractions;

namespace Softaxis.Messaging.Infrastructure.Services;

/// <summary>
/// WhatsApp Cloud API over a typed HttpClient (Meta has no maintained .NET SDK). Every call
/// returns Meta's own error message instead of throwing, so the caller can show it to the user.
/// </summary>
public sealed class MetaWhatsAppClient(IHttpClientFactory http, IConfiguration config, ILogger<MetaWhatsAppClient> log)
    : IWhatsAppClient
{
    public const string HttpClientName = "whatsapp-cloud";

    private string Base => (config["Messaging:WhatsApp:GraphBaseUrl"] ?? "https://graph.facebook.com/v21.0").TrimEnd('/');

    public async Task<WaCallResult<WaPhoneProfile>> GetPhoneProfileAsync(string phoneNumberId, string token, CancellationToken ct)
    {
        var (json, error) = await CallAsync(HttpMethod.Get, $"{phoneNumberId}?fields=display_phone_number,verified_name", token, null, ct);
        return error is not null
            ? WaCallResult<WaPhoneProfile>.Fail(error)
            : WaCallResult<WaPhoneProfile>.Success(new WaPhoneProfile(
                json?["display_phone_number"]?.GetValue<string>(), json?["verified_name"]?.GetValue<string>()));
    }

    public async Task<WaCallResult<IReadOnlyList<WaRemoteTemplate>>> GetTemplatesAsync(string wabaId, string token, CancellationToken ct)
    {
        var list = new List<WaRemoteTemplate>();
        var path = $"{wabaId}/message_templates?limit=100&fields=id,name,language,category,status,components,rejected_reason";

        // Follow paging, but bounded — a runaway "next" link must not loop for ever.
        for (var page = 0; page < 20 && path is not null; page++)
        {
            var (json, error) = await CallAsync(HttpMethod.Get, path, token, null, ct);
            if (error is not null) return WaCallResult<IReadOnlyList<WaRemoteTemplate>>.Fail(error);

            foreach (var t in json?["data"]?.AsArray() ?? [])
            {
                if (t is null) continue;
                string? header = null, body = "", footer = null;
                foreach (var c in t["components"]?.AsArray() ?? [])
                {
                    var type = c?["type"]?.GetValue<string>();
                    var text = c?["text"]?.GetValue<string>();
                    if (type == "HEADER" && c?["format"]?.GetValue<string>() == "TEXT") header = text;
                    else if (type == "BODY") body = text ?? "";
                    else if (type == "FOOTER") footer = text;
                }
                list.Add(new WaRemoteTemplate(
                    t["id"]?.GetValue<string>() ?? "",
                    t["name"]?.GetValue<string>() ?? "",
                    t["language"]?.GetValue<string>() ?? "en",
                    t["category"]?.GetValue<string>() ?? "UTILITY",
                    t["status"]?.GetValue<string>() ?? "PENDING",
                    header, body, footer,
                    t["rejected_reason"]?.GetValue<string>()));
            }

            var next = json?["paging"]?["next"]?.GetValue<string>();
            path = next is null ? null : next.Replace(Base + "/", "");
        }
        return WaCallResult<IReadOnlyList<WaRemoteTemplate>>.Success(list);
    }

    public async Task<WaCallResult<string>> CreateTemplateAsync(string wabaId, string token, WaNewTemplate t, CancellationToken ct)
    {
        var components = new JsonArray();
        if (!string.IsNullOrWhiteSpace(t.Header))
            components.Add(new JsonObject { ["type"] = "HEADER", ["format"] = "TEXT", ["text"] = t.Header });

        var body = new JsonObject { ["type"] = "BODY", ["text"] = t.Body };
        if (t.BodyExamples.Count > 0)
            body["example"] = new JsonObject
            {
                ["body_text"] = new JsonArray(new JsonArray(t.BodyExamples.Select(e => (JsonNode)JsonValue.Create(e)!).ToArray())),
            };
        components.Add(body);

        if (!string.IsNullOrWhiteSpace(t.Footer))
            components.Add(new JsonObject { ["type"] = "FOOTER", ["text"] = t.Footer });

        var payload = new JsonObject
        {
            ["name"] = t.Name, ["language"] = t.Language, ["category"] = t.Category, ["components"] = components,
        };

        var (json, error) = await CallAsync(HttpMethod.Post, $"{wabaId}/message_templates", token, payload, ct);
        return error is not null
            ? WaCallResult<string>.Fail(error)
            : WaCallResult<string>.Success(json?["status"]?.GetValue<string>() ?? "PENDING");
    }

    public Task<WaCallResult<string>> SendTextAsync(string phoneNumberId, string token, string to, string text, CancellationToken ct) =>
        SendAsync(phoneNumberId, token, new JsonObject
        {
            ["messaging_product"] = "whatsapp", ["recipient_type"] = "individual", ["to"] = to, ["type"] = "text",
            ["text"] = new JsonObject { ["preview_url"] = true, ["body"] = text },
        }, ct);

    public Task<WaCallResult<string>> SendTemplateAsync(string phoneNumberId, string token, string to, string name,
        string language, IReadOnlyList<string> variables, CancellationToken ct)
    {
        var template = new JsonObject { ["name"] = name, ["language"] = new JsonObject { ["code"] = language } };
        if (variables.Count > 0)
            template["components"] = new JsonArray(new JsonObject
            {
                ["type"] = "body",
                ["parameters"] = new JsonArray(variables
                    .Select(v => (JsonNode)new JsonObject { ["type"] = "text", ["text"] = string.IsNullOrWhiteSpace(v) ? "-" : v })
                    .ToArray()),
            });

        return SendAsync(phoneNumberId, token, new JsonObject
        {
            ["messaging_product"] = "whatsapp", ["to"] = to, ["type"] = "template", ["template"] = template,
        }, ct);
    }

    public async Task MarkReadAsync(string phoneNumberId, string token, string waMessageId, CancellationToken ct)
    {
        // Blue ticks are a courtesy: a failure here must never stop the inbox.
        try
        {
            await CallAsync(HttpMethod.Post, $"{phoneNumberId}/messages", token, new JsonObject
            {
                ["messaging_product"] = "whatsapp", ["status"] = "read", ["message_id"] = waMessageId,
            }, ct);
        }
        catch (Exception ex) { log.LogDebug(ex, "WhatsApp mark-read failed"); }
    }

    private async Task<WaCallResult<string>> SendAsync(string phoneNumberId, string token, JsonObject payload, CancellationToken ct)
    {
        var (json, error) = await CallAsync(HttpMethod.Post, $"{phoneNumberId}/messages", token, payload, ct);
        if (error is not null) return WaCallResult<string>.Fail(error);
        var id = json?["messages"]?[0]?["id"]?.GetValue<string>();
        return id is null ? WaCallResult<string>.Fail("WhatsApp accepted the request but returned no message id.")
                          : WaCallResult<string>.Success(id);
    }

    private async Task<(JsonNode? Json, string? Error)> CallAsync(HttpMethod method, string path, string token,
        JsonObject? body, CancellationToken ct)
    {
        try
        {
            using var req = new HttpRequestMessage(method, $"{Base}/{path.TrimStart('/')}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (body is not null) req.Content = JsonContent.Create(body);

            using var res = await http.CreateClient(HttpClientName).SendAsync(req, ct);
            var text = await res.Content.ReadAsStringAsync(ct);
            JsonNode? json = null;
            try { json = string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text); } catch (JsonException) { }

            if (res.IsSuccessStatusCode) return (json, null);

            var err = json?["error"];
            var msg = err?["error_user_msg"]?.GetValue<string>()
                      ?? err?["message"]?.GetValue<string>()
                      ?? $"WhatsApp returned HTTP {(int)res.StatusCode}.";
            var code = err?["code"]?.ToString();
            return (json, code is null ? msg : $"{msg} (code {code})");
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return (null, "WhatsApp did not answer in time. Try again.");
        }
        catch (HttpRequestException ex)
        {
            return (null, $"Could not reach WhatsApp: {ex.Message}");
        }
    }
}

public sealed class MessagingSecretProtector(IDataProtectionProvider provider) : IMessagingSecretProtector
{
    private readonly IDataProtector _p = provider.CreateProtector("Softaxis.Messaging.WhatsApp.Token.v1");

    public string Protect(string plain) => _p.Protect(plain);

    public string? Unprotect(string cipher)
    {
        try { return _p.Unprotect(cipher); }
        catch { return null; }   // key ring rotated / lost: treat as "reconnect needed", not a crash
    }
}
