using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Softaxis.AiAssistant.Infrastructure.Telegram;

/// <summary>Thin Telegram Bot API client — send a message, register a webhook.</summary>
public sealed class TelegramClient(IHttpClientFactory httpClientFactory)
{
    private static string Api(string botToken, string method) => $"https://api.telegram.org/bot{botToken}/{method}";

    public async Task SendMessageAsync(string botToken, long chatId, string text, CancellationToken ct)
    {
        var body = new JsonObject { ["chat_id"] = chatId, ["text"] = Trim(text) };
        using var http = httpClientFactory.CreateClient("ai");
        using var content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        try { await http.PostAsync(Api(botToken, "sendMessage"), content, ct); }
        catch { /* best-effort — a failed send shouldn't 500 the webhook */ }
    }

    /// <summary>Registers the webhook URL with Telegram. Returns (ok, description).</summary>
    public async Task<(bool Ok, string Description)> SetWebhookAsync(string botToken, string url, CancellationToken ct)
    {
        var body = new JsonObject { ["url"] = url };
        using var http = httpClientFactory.CreateClient("ai");
        using var content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        try
        {
            using var res = await http.PostAsync(Api(botToken, "setWebhook"), content, ct);
            var payload = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(payload);
            var ok = doc.RootElement.TryGetProperty("ok", out var o) && o.GetBoolean();
            var desc = doc.RootElement.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
            return (ok, desc);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private static string Trim(string s) => s.Length > 4000 ? s[..4000] : s; // Telegram message cap ~4096
}
