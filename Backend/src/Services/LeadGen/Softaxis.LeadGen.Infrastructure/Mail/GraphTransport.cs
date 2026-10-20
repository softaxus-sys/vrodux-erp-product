using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace Softaxis.LeadGen.Infrastructure.Mail;

/// <summary>
/// Microsoft 365 / Outlook over Microsoft Graph. Mail is created as a draft and then sent, because
/// that is the only way to learn the message's id and conversation (the plain sendMail call returns
/// nothing), and those are what let a reply be matched to the email that started it.
/// </summary>
internal sealed class GraphTransport(IHttpClientFactory http, ILogger<GraphTransport> logger) : IMailTransport
{
    public string Provider => Domain.Entities.MailboxProvider.Microsoft;
    private const string Api = "https://graph.microsoft.com/v1.0/me";

    public async Task<SentEmail> SendAsync(MailCredentials c, OutgoingEmail mail, CancellationToken ct)
    {
        JsonElement draft;
        if (!string.IsNullOrEmpty(mail.ReplyToProviderMessageId))
        {
            // A reply in the same conversation: Graph builds the threading headers for us.
            draft = await CallAsync(c, HttpMethod.Post, $"{Api}/messages/{Uri.EscapeDataString(mail.ReplyToProviderMessageId)}/createReply", new { }, ct);
            var replyId = draft.GetProperty("id").GetString()!;
            await CallAsync(c, new HttpMethod("PATCH"), $"{Api}/messages/{Uri.EscapeDataString(replyId)}",
                new { body = new { contentType = "HTML", content = mail.BodyHtml } }, ct);
        }
        else
        {
            draft = await CallAsync(c, HttpMethod.Post, $"{Api}/messages", new
            {
                subject = mail.Subject,
                body = new { contentType = "HTML", content = mail.BodyHtml },
                toRecipients = new[] { new { emailAddress = new { address = mail.To } } },
                ccRecipients = (mail.Cc ?? "").Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(a => new { emailAddress = new { address = a } }).ToArray(),
            }, ct);
        }

        var id = draft.GetProperty("id").GetString()!;
        await CallAsync(c, HttpMethod.Post, $"{Api}/messages/{Uri.EscapeDataString(id)}/send", null, ct);

        // After sending, read back the Internet message id and conversation. The id stays valid because
        // every request asks for immutable ids.
        string? messageId = null, conversation = draft.TryGetProperty("conversationId", out var cv) ? cv.GetString() : null;
        for (var attempt = 0; attempt < 3 && messageId is null; attempt++)
        {
            try
            {
                if (attempt > 0) await Task.Delay(1200, ct);
                var sent = await CallAsync(c, HttpMethod.Get, $"{Api}/messages/{Uri.EscapeDataString(id)}?$select=internetMessageId,conversationId", null, ct);
                messageId = sent.TryGetProperty("internetMessageId", out var im) ? im.GetString() : null;
                conversation = sent.TryGetProperty("conversationId", out var c2) ? c2.GetString() : conversation;
            }
            catch (MailRejectedException) { /* not in Sent Items yet */ }
        }
        return new SentEmail(id, conversation, messageId, DateTime.UtcNow);
    }

    public async Task<FetchResult> FetchAsync(MailCredentials c, string? cursor, DateTime sinceUtc, CancellationToken ct)
    {
        var from = sinceUtc < DateTime.UtcNow.AddDays(-3) ? DateTime.UtcNow.AddDays(-3) : sinceUtc;
        if (cursor is not null && DateTime.TryParse(cursor, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var parsed))
            from = parsed.AddMinutes(-2);   // small overlap; duplicates are dropped by id

        var url = $"{Api}/mailFolders/inbox/messages?$filter=receivedDateTime ge {from:yyyy-MM-ddTHH:mm:ssZ}" +
                  "&$orderby=receivedDateTime asc&$top=50&$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,body,receivedDateTime,internetMessageHeaders";

        var list = new List<IncomingEmail>(); DateTime latest = from; var pages = 0;
        while (url is not null && pages++ < 4)
        {
            var root = await CallAsync(c, HttpMethod.Get, url, null, ct, preferText: true);
            if (root.TryGetProperty("value", out var items))
                foreach (var m in items.EnumerateArray())
                {
                    var addr = m.TryGetProperty("from", out var f) && f.TryGetProperty("emailAddress", out var ea) && ea.TryGetProperty("address", out var a) ? a.GetString()?.ToLowerInvariant() : null;
                    if (addr is null || addr == c.Address.ToLowerInvariant()) continue;

                    var received = m.TryGetProperty("receivedDateTime", out var rd) && rd.TryGetDateTime(out var dt) ? dt.ToUniversalTime() : DateTime.UtcNow;
                    if (received > latest) latest = received;

                    var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    if (m.TryGetProperty("internetMessageHeaders", out var hs) && hs.ValueKind == JsonValueKind.Array)
                        foreach (var h in hs.EnumerateArray())
                            headers[h.GetProperty("name").GetString() ?? ""] = h.GetProperty("value").GetString() ?? "";

                    // Reuse the MIME reader (bounce and auto-reply detection) on a message rebuilt from Graph's fields.
                    var mime = new MimeMessage();
                    mime.From.Add(new MailboxAddress(m.GetProperty("from").GetProperty("emailAddress").TryGetProperty("name", out var nm) ? nm.GetString() : addr, addr));
                    mime.To.Add(new MailboxAddress("", c.Address));
                    mime.Subject = m.TryGetProperty("subject", out var sj) ? sj.GetString() ?? "" : "";
                    mime.Date = received;
                    if (m.TryGetProperty("internetMessageId", out var mid) && mid.GetString() is { Length: > 0 } midText) mime.MessageId = midText.Trim('<', '>');
                    if (headers.TryGetValue("In-Reply-To", out var irt)) mime.InReplyTo = irt.Trim('<', '>', ' ');
                    if (headers.TryGetValue("References", out var refs))
                        foreach (var r in refs.Split([' ', '\t', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)) mime.References.Add(r.Trim('<', '>'));
                    foreach (var name in new[] { "Auto-Submitted", "Precedence", "X-Autoreply", "X-Failed-Recipients" })
                        if (headers.TryGetValue(name, out var hv)) mime.Headers.Add(name, hv);

                    var text = m.TryGetProperty("body", out var b) && b.TryGetProperty("content", out var ct2) ? ct2.GetString() : null;
                    mime.Body = new TextPart("plain") { Text = text ?? "" };

                    list.Add(MimeSupport.Parse(mime, m.GetProperty("id").GetString()!,
                        m.TryGetProperty("conversationId", out var cid) ? cid.GetString() : null, received));
                }
            url = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }
        return new FetchResult(list, latest.ToString("o"));
    }

    private async Task<JsonElement> CallAsync(MailCredentials c, HttpMethod method, string url, object? body, CancellationToken ct, bool preferText = false)
    {
        using var client = http.CreateClient("leadgen-api");
        using var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", c.AccessToken);
        req.Headers.TryAddWithoutValidation("Prefer", preferText ? "IdType=\"ImmutableId\", outlook.body-content-type=\"text\"" : "IdType=\"ImmutableId\"");
        if (body is not null) req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        else if (method == HttpMethod.Post) req.Content = new StringContent("", Encoding.UTF8, "application/json");

        using var res = await client.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (res.IsSuccessStatusCode) return string.IsNullOrWhiteSpace(text) ? JsonSerializer.Deserialize<JsonElement>("{}") : JsonSerializer.Deserialize<JsonElement>(text).Clone();

        var reason = Reason(text);
        logger.LogDebug("Graph {Method} {Status}: {Reason}", method, (int)res.StatusCode, reason);
        if (res.StatusCode == HttpStatusCode.Unauthorized)
            throw new MailAuthException("Microsoft access expired or was revoked. Reconnect this mailbox.");
        if (res.StatusCode == HttpStatusCode.Forbidden)
            throw new MailAuthException("Microsoft did not grant permission to send and read mail. Reconnect and accept every permission.");
        if (res.StatusCode is HttpStatusCode.TooManyRequests or HttpStatusCode.ServiceUnavailable or HttpStatusCode.BadGateway or HttpStatusCode.GatewayTimeout or HttpStatusCode.InternalServerError)
            throw new MailTransientException($"Microsoft asked us to slow down or is unavailable ({(int)res.StatusCode}).");
        throw new MailRejectedException(reason ?? $"Microsoft refused the request ({(int)res.StatusCode}).");
    }

    private static string? Reason(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("error", out var e) && e.TryGetProperty("message", out var m) ? m.GetString() : null;
        }
        catch (JsonException) { return null; }
    }
}
