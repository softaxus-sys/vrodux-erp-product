using System.Net;
using System.Net.Sockets;
using System.Text.RegularExpressions;
using MimeKit;
using MimeKit.Text;
using Softaxis.LeadGen.Infrastructure.Providers;

namespace Softaxis.LeadGen.Infrastructure.Mail;

/// <summary>
/// Opens a socket to a mail server the USER named — which makes it a server-side request forgery
/// vector if left alone: someone could "connect a mailbox" at 127.0.0.1:5432 or a cloud metadata
/// address. The host is resolved here, every address is checked to be on the public internet, and
/// the connection is made to that exact address, so a second DNS lookup cannot swap it for a
/// private one afterwards.
/// </summary>
internal static class SafeSocket
{
    public static async Task<Socket> ConnectAsync(string host, int port, CancellationToken ct)
    {
        IPAddress[] all;
        try { all = await Dns.GetHostAddressesAsync(host, ct); }
        catch (SocketException) { throw new MailTransientException($"The server \"{host}\" could not be found."); }

        var safe = all.Where(SafeHttp.IsPublic).ToArray();
        if (safe.Length == 0) throw new MailRejectedException("That server address is not allowed.");

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(12));
            await socket.ConnectAsync(safe, port, timeout.Token);
            return socket;
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException)
        {
            socket.Dispose();
            if (ct.IsCancellationRequested) throw;
            throw new MailTransientException($"Could not connect to {host}:{port}.", ex);
        }
    }
}

internal static partial class MimeSupport
{
    /// <summary>Builds the message every SMTP-style transport sends, with the headers that make threads and unsubscribes work.</summary>
    public static MimeMessage Build(OutgoingEmail m)
    {
        var msg = new MimeMessage();
        msg.From.Add(new MailboxAddress(m.FromName ?? m.FromAddress, m.FromAddress));
        msg.To.Add(MailboxAddress.Parse(m.To));
        if (!string.IsNullOrWhiteSpace(m.Cc)) foreach (var c in m.Cc.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) msg.Cc.Add(MailboxAddress.Parse(c));
        msg.Subject = m.Subject;
        msg.MessageId = m.MessageId.Trim('<', '>');
        if (!string.IsNullOrWhiteSpace(m.InReplyTo)) msg.InReplyTo = m.InReplyTo.Trim('<', '>');
        foreach (var r in m.References) msg.References.Add(r.Trim('<', '>'));

        if (!string.IsNullOrWhiteSpace(m.ListUnsubscribeUrl))
        {
            // RFC 8058 one-click: lets Gmail and Outlook show their own "Unsubscribe" button, which is
            // better for the recipient and far better for our sender reputation than a spam report.
            msg.Headers.Add("List-Unsubscribe", $"<{m.ListUnsubscribeUrl}>");
            msg.Headers.Add("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
        }

        var body = new BodyBuilder { TextBody = m.BodyText, HtmlBody = m.BodyHtml };
        msg.Body = body.ToMessageBody();
        return msg;
    }

    // ── Reading ──────────────────────────────────────────────────────────────────────────────

    public static IncomingEmail Parse(MimeMessage msg, string providerId, string? providerThreadId, DateTime? receivedFallback)
    {
        var from = msg.From.Mailboxes.FirstOrDefault();
        var fromAddr = (from?.Address ?? "").ToLowerInvariant();
        var text = msg.TextBody;
        if (string.IsNullOrWhiteSpace(text) && !string.IsNullOrWhiteSpace(msg.HtmlBody))
            text = StripHtml(msg.HtmlBody);
        text = Clean(text);

        var (isBounce, bounceRcpt, bounceReason) = DetectBounce(msg, fromAddr, text);
        var references = msg.References.Select(r => "<" + r + ">").ToList();

        return new IncomingEmail(
            providerId, providerThreadId,
            msg.MessageId is { Length: > 0 } id ? "<" + id + ">" : null,
            msg.InReplyTo is { Length: > 0 } irt ? "<" + irt + ">" : null,
            references, fromAddr, from?.Name,
            msg.To.Mailboxes.FirstOrDefault()?.Address?.ToLowerInvariant() ?? "",
            msg.Cc.Count == 0 ? null : string.Join(", ", msg.Cc.Mailboxes.Select(c => c.Address)),
            msg.Subject ?? "", text,
            msg.Date == DateTimeOffset.MinValue ? (receivedFallback ?? DateTime.UtcNow) : msg.Date.UtcDateTime,
            isBounce, bounceRcpt, bounceReason, IsAutoReply(msg));
    }

    /// <summary>HTML to readable text, for messages that arrive with no plain-text part.</summary>
    private static string StripHtml(string html)
    {
        var t = Regex.Replace(html, @"<(script|style)\b.*?</\1>", " ", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        t = Regex.Replace(t, @"<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", RegexOptions.IgnoreCase);
        t = Regex.Replace(t, "<[^>]+>", " ");
        t = WebUtility.HtmlDecode(t);
        t = Regex.Replace(t, @"[ \t]+", " ");
        return Regex.Replace(t, @"\n\s*\n\s*\n+", "\n\n").Trim();
    }

    private static string? Clean(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        text = text.Replace("\r\n", "\n").Trim();
        return text.Length > 40_000 ? text[..40_000] : text;
    }

    private static bool IsAutoReply(MimeMessage msg)
    {
        var auto = msg.Headers["Auto-Submitted"];
        if (!string.IsNullOrEmpty(auto) && !auto.Equals("no", StringComparison.OrdinalIgnoreCase)) return true;
        if (msg.Headers["X-Autoreply"] is not null || msg.Headers["X-Autorespond"] is not null) return true;
        var prec = msg.Headers["Precedence"];
        if (prec is not null && (prec.Contains("auto_reply", StringComparison.OrdinalIgnoreCase) || prec.Contains("bulk", StringComparison.OrdinalIgnoreCase) || prec.Contains("junk", StringComparison.OrdinalIgnoreCase))) return true;
        var subj = msg.Subject ?? "";
        return AutoSubject().IsMatch(subj);
    }

    [GeneratedRegex(@"^\s*(automatic reply|auto[- ]?reply|autoreply|out of office|out-of-office|away from (the )?office|vacation reply|الرد التلقائي|خارج المكتب)", RegexOptions.IgnoreCase)]
    private static partial Regex AutoSubject();

    [GeneratedRegex(@"(?:Final-Recipient|Original-Recipient):\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?", RegexOptions.IgnoreCase)]
    private static partial Regex FinalRecipient();
    [GeneratedRegex(@"(?:to|for|recipient|address)[:\s]+<?([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})>?", RegexOptions.IgnoreCase)]
    private static partial Regex LooseRecipient();
    [GeneratedRegex(@"Diagnostic-Code:\s*(?:smtp;\s*)?(.{5,200})", RegexOptions.IgnoreCase)]
    private static partial Regex Diagnostic();
    [GeneratedRegex(@"\b5\.\d\.\d+\b")]
    private static partial Regex HardStatus();

    /// <summary>
    /// A delivery failure notice, and who it was about. Only permanent failures (5.x.x) count as a
    /// bounce that should suppress the address; a "mailbox full" or "try again later" does not.
    /// </summary>
    private static (bool isBounce, string? recipient, string? reason) DetectBounce(MimeMessage msg, string from, string? text)
    {
        var looksLike = from.StartsWith("mailer-daemon@") || from.StartsWith("postmaster@") || from.Contains("mailer-daemon")
            || (msg.Subject ?? "").Contains("Undelivered Mail", StringComparison.OrdinalIgnoreCase)
            || (msg.Subject ?? "").Contains("Delivery Status Notification", StringComparison.OrdinalIgnoreCase)
            || (msg.Subject ?? "").Contains("Mail delivery failed", StringComparison.OrdinalIgnoreCase)
            || (msg.Subject ?? "").Contains("Returned mail", StringComparison.OrdinalIgnoreCase)
            || (msg.Subject ?? "").Contains("Undeliverable", StringComparison.OrdinalIgnoreCase)
            || msg.Body is MultipartReport;
        if (!looksLike) return (false, null, null);

        string? recipient = msg.Headers["X-Failed-Recipients"]?.Split(',')[0].Trim();
        string? reason = null; var permanent = false;

        // The machine-readable part, when there is one.
        foreach (var part in msg.BodyParts.OfType<MessageDeliveryStatus>())
            foreach (var group in part.StatusGroups)
            {
                if (recipient is null && group.Contains("Final-Recipient"))
                {
                    var m = FinalRecipient().Match("Final-Recipient: " + group["Final-Recipient"]);
                    if (m.Success) recipient = m.Groups[1].Value;
                }
                if (group.Contains("Action") && group["Action"].Trim().Equals("failed", StringComparison.OrdinalIgnoreCase)) permanent = true;
                if (group.Contains("Status") && group["Status"].Trim().StartsWith('5')) permanent = true;
                if (group.Contains("Diagnostic-Code")) reason ??= group["Diagnostic-Code"].Trim();
            }

        if (text is not null)
        {
            if (recipient is null && FinalRecipient().Match(text) is { Success: true } fr) recipient = fr.Groups[1].Value;
            if (recipient is null && LooseRecipient().Match(text) is { Success: true } lr) recipient = lr.Groups[1].Value;
            if (reason is null && Diagnostic().Match(text) is { Success: true } dg) reason = dg.Groups[1].Value.Trim();
            if (!permanent && HardStatus().IsMatch(text)) permanent = true;
            if (!permanent && Regex.IsMatch(text, @"(user unknown|no such user|mailbox (unavailable|not found)|does not exist|address rejected|recipient (address )?rejected|550 )", RegexOptions.IgnoreCase)) permanent = true;
        }

        recipient = recipient?.Trim('<', '>', ' ', '.', ';').ToLowerInvariant();
        if (reason is { Length: > 200 }) reason = reason[..200];
        // Without a recipient or a permanent failure there is nothing safe to act on.
        return (permanent && recipient is not null, recipient, reason);
    }
}
