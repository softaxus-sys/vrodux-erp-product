using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Softaxis.LeadGen.Infrastructure.Mail;

/// <summary>
/// Gmail / Google Workspace over the Gmail REST API. Sending goes through Google's own servers as the
/// signed-in user, so the mail is authenticated by Google and lands in the Sent folder like any other.
/// Hand-rolled over HttpClient, like every other integration in this codebase.
/// </summary>
internal sealed class GmailTransport(IHttpClientFactory http, ILogger<GmailTransport> logger) : IMailTransport
{
    public string Provider => Domain.Entities.MailboxProvider.Google;
    private const string Api = "https://gmail.googleapis.com/gmail/v1/users/me";

    public async Task<SentEmail> SendAsync(MailCredentials c, OutgoingEmail mail, CancellationToken ct)
    {
        var msg = MimeSupport.Build(mail);
        using var ms = new MemoryStream();
        await msg.WriteToAsync(ms, ct);
        var raw = Convert.ToBase64String(ms.ToArray()).Replace('+', '-').Replace('/', '_').TrimEnd('=');

        var body = new Dictionary<string, object?> { ["raw"] = raw };
        if (!string.IsNullOrEmpty(mail.ProviderThreadId)) body["threadId"] = mail.ProviderThreadId;

        var root = await SendJsonAsync(c, HttpMethod.Post, $"{Api}/messages/send", body, ct);
        var id = root.GetProperty("id").GetString();
        var threadId = root.TryGetProperty("threadId", out var t) ? t.GetString() : null;

        // Gmail may assign its own Message-ID; replies point at whichever it really used, so read it back.
        string? messageId = "<" + msg.MessageId + ">";
        try
        {
            var meta = await SendJsonAsync(c, HttpMethod.Get, $"{Api}/messages/{id}?format=metadata&metadataHeaders=Message-ID", null, ct);
            if (meta.TryGetProperty("payload", out var p) && p.TryGetProperty("headers", out var hs))
                foreach (var h in hs.EnumerateArray())
                    if (string.Equals(h.GetProperty("name").GetString(), "Message-ID", StringComparison.OrdinalIgnoreCase))
                        messageId = h.GetProperty("value").GetString();
        }
        catch (Exception ex) when (ex is not OperationCanceledException) { logger.LogDebug(ex, "Could not read back the Gmail Message-ID."); }

        return new SentEmail(id, threadId, messageId, DateTime.UtcNow);
    }

    public async Task<FetchResult> FetchAsync(MailCredentials c, string? cursor, DateTime sinceUtc, CancellationToken ct)
    {
        var ids = new List<string>(); string? newCursor;

        // The history id is read BEFORE listing, so anything arriving while we list is picked up next time.
        var profile = await SendJsonAsync(c, HttpMethod.Get, $"{Api}/profile", null, ct);
        var currentHistory = profile.GetProperty("historyId").GetString();
        newCursor = currentHistory;

        var listed = false;
        if (cursor is not null)
        {
            try
            {
                string? page = null;
                do
                {
                    var url = $"{Api}/history?startHistoryId={Uri.EscapeDataString(cursor)}&historyTypes=messageAdded&labelId=INBOX&maxResults=100"
                              + (page is null ? "" : $"&pageToken={Uri.EscapeDataString(page)}");
                    var h = await SendJsonAsync(c, HttpMethod.Get, url, null, ct);
                    if (h.TryGetProperty("history", out var hist))
                        foreach (var rec in hist.EnumerateArray())
                            if (rec.TryGetProperty("messagesAdded", out var added))
                                foreach (var a in added.EnumerateArray())
                                    if (a.GetProperty("message").GetProperty("id").GetString() is { } mid && !ids.Contains(mid)) ids.Add(mid);
                    page = h.TryGetProperty("nextPageToken", out var np) ? np.GetString() : null;
                } while (page is not null && ids.Count < 200);
                listed = true;
            }
            catch (GmailNotFoundException) { listed = false; }   // the history window expired; fall back to a date search
        }

        if (!listed)
        {
            var from = sinceUtc < DateTime.UtcNow.AddDays(-3) ? DateTime.UtcNow.AddDays(-3) : sinceUtc;
            var epoch = new DateTimeOffset(from).ToUnixTimeSeconds();
            var l = await SendJsonAsync(c, HttpMethod.Get, $"{Api}/messages?q={Uri.EscapeDataString($"in:inbox after:{epoch}")}&maxResults=100", null, ct);
            if (l.TryGetProperty("messages", out var ms))
                foreach (var m in ms.EnumerateArray()) if (m.GetProperty("id").GetString() is { } mid) ids.Add(mid);
        }

        var list = new List<IncomingEmail>();
        foreach (var id in ids.Take(150))
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var m = await SendJsonAsync(c, HttpMethod.Get, $"{Api}/messages/{id}?format=raw", null, ct);
                var rawB64 = m.GetProperty("raw").GetString()!.Replace('-', '+').Replace('_', '/');
                rawB64 = rawB64.PadRight(rawB64.Length + (4 - rawB64.Length % 4) % 4, '=');
                using var stream = new MemoryStream(Convert.FromBase64String(rawB64));
                var mime = await MimeMessage.LoadAsync(stream, ct);

                var from = mime.From.Mailboxes.FirstOrDefault()?.Address?.ToLowerInvariant();
                if (from == c.Address.ToLowerInvariant()) continue;   // our own mail
                var threadId = m.TryGetProperty("threadId", out var t) ? t.GetString() : null;
                DateTime? internalDate = m.TryGetProperty("internalDate", out var d) && long.TryParse(d.GetString(), out var ms2)
                    ? DateTimeOffset.FromUnixTimeMilliseconds(ms2).UtcDateTime : null;
                list.Add(MimeSupport.Parse(mime, id, threadId, internalDate));
            }
            catch (GmailNotFoundException) { }   // deleted between listing and reading
        }

        return new FetchResult(list, newCursor);
    }

    private sealed class GmailNotFoundException : Exception;

    private async Task<JsonElement> SendJsonAsync(MailCredentials c, HttpMethod method, string url, object? body, CancellationToken ct)
    {
        using var client = http.CreateClient("leadgen-api");
        using var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", c.AccessToken);
        if (body is not null) req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        using var res = await client.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (res.IsSuccessStatusCode) return JsonSerializer.Deserialize<JsonElement>(string.IsNullOrWhiteSpace(text) ? "{}" : text).Clone();

        var reason = ErrorReason(text);
        if (res.StatusCode == HttpStatusCode.NotFound) throw new GmailNotFoundException();
        if (res.StatusCode == HttpStatusCode.Unauthorized)
            throw new MailAuthException("Google access expired or was revoked. Reconnect this mailbox.");
        if (res.StatusCode == HttpStatusCode.Forbidden && reason is { } r && (r.Contains("insufficient", StringComparison.OrdinalIgnoreCase) || r.Contains("scope", StringComparison.OrdinalIgnoreCase)))
            throw new MailAuthException("Google did not grant permission to send and read mail. Reconnect and allow every checkbox.");
        if (res.StatusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.Forbidden or HttpStatusCode.ServiceUnavailable or HttpStatusCode.BadGateway or HttpStatusCode.InternalServerError)
            throw new MailTransientException($"Google asked us to slow down or is unavailable ({(int)res.StatusCode}).");
        throw new MailRejectedException(reason ?? $"Google refused the message ({(int)res.StatusCode}).");
    }

    private static string? ErrorReason(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("error", out var e) && e.TryGetProperty("message", out var m) ? m.GetString() : null;
        }
        catch (JsonException) { return null; }
    }
}
