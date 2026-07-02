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

    /// <summary>Downloads a file (e.g. a voice note) by its Telegram file_id. Returns (bytes, fileName) or null.</summary>
    public async Task<(byte[] Bytes, string FileName)?> DownloadFileAsync(string botToken, string fileId, CancellationToken ct)
    {
        try
        {
            using var http = httpClientFactory.CreateClient("ai");

            // 1) Resolve file_path via getFile.
            using var res = await http.GetAsync(Api(botToken, $"getFile?file_id={Uri.EscapeDataString(fileId)}"), ct);
            var payload = await res.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(payload);
            if (!doc.RootElement.TryGetProperty("ok", out var ok) || !ok.GetBoolean()) return null;
            var filePath = doc.RootElement.GetProperty("result").GetProperty("file_path").GetString();
            if (string.IsNullOrEmpty(filePath)) return null;

            // 2) Download the bytes.
            var url = $"https://api.telegram.org/file/bot{botToken}/{filePath}";
            var bytes = await http.GetByteArrayAsync(url, ct);
            var name = System.IO.Path.GetFileName(filePath);
            return (bytes, string.IsNullOrEmpty(name) ? "voice.ogg" : name);
        }
        catch
        {
            return null;
        }
    }

    private static string Trim(string s) => s.Length > 4000 ? s[..4000] : s; // Telegram message cap ~4096
}
