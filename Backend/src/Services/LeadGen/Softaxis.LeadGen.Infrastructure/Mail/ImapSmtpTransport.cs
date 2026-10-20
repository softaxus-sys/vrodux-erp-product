using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using Microsoft.Extensions.Logging;

namespace Softaxis.LeadGen.Infrastructure.Mail;

/// <summary>
/// Any mailbox that speaks SMTP to send and IMAP to read — Zoho, a company's own server, cPanel
/// hosting, Fastmail. Connections go through <see cref="SafeSocket"/>, so a user-supplied host can
/// never be an internal address.
/// </summary>
internal sealed class ImapSmtpTransport(ILogger<ImapSmtpTransport> logger) : IMailTransport
{
    public string Provider => Domain.Entities.MailboxProvider.Imap;

    private static SecureSocketOptions SmtpSecurity(int port) => port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
    private static SecureSocketOptions ImapSecurity(int port) => port == 993 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

    // ── Send ─────────────────────────────────────────────────────────────────────────────────

    public async Task<SentEmail> SendAsync(MailCredentials c, OutgoingEmail mail, CancellationToken ct)
    {
        if (c.SmtpHost is null || c.SmtpPort is null) throw new MailRejectedException("This mailbox has no sending server set.");
        var msg = MimeSupport.Build(mail);

        using var smtp = new SmtpClient { Timeout = 25_000 };
        try
        {
            var socket = await SafeSocket.ConnectAsync(c.SmtpHost, c.SmtpPort.Value, ct);
            await smtp.ConnectAsync(socket, c.SmtpHost, c.SmtpPort.Value, SmtpSecurity(c.SmtpPort.Value), ct);
            await smtp.AuthenticateAsync(c.Username ?? c.Address, c.Password, ct);
            await smtp.SendAsync(msg, ct);
            await smtp.DisconnectAsync(true, ct);
            return new SentEmail(null, null, "<" + msg.MessageId + ">", DateTime.UtcNow);
        }
        catch (AuthenticationException ex) { throw new MailAuthException("The mailbox refused the username or password." + Hint(ex)); }
        catch (SmtpCommandException ex) when (ex.ErrorCode is SmtpErrorCode.RecipientNotAccepted or SmtpErrorCode.SenderNotAccepted
            or SmtpErrorCode.MessageNotAccepted && (int)ex.StatusCode >= 550)
        { throw new MailRejectedException(Short(ex.Message)); }
        catch (SmtpCommandException ex) when ((int)ex.StatusCode is >= 500 and < 600 && ex.StatusCode != SmtpStatusCode.ServiceNotAvailable)
        { throw new MailRejectedException(Short(ex.Message)); }
        catch (Exception ex) when (ex is SmtpCommandException or SmtpProtocolException or ServiceNotConnectedException or ServiceNotAuthenticatedException or IOException or System.Net.Sockets.SocketException or TimeoutException)
        { throw new MailTransientException("The mail server did not accept the message right now: " + Short(ex.Message), ex); }
    }

    private static string Hint(Exception ex) =>
        " If the account uses two-step verification, create an app password and use that." + (ex.Message.Length < 120 ? "" : "");

    private static string Short(string s) => s.Length > 200 ? s[..200] : s;

    // ── Read ─────────────────────────────────────────────────────────────────────────────────

    public async Task<FetchResult> FetchAsync(MailCredentials c, string? cursor, DateTime sinceUtc, CancellationToken ct)
    {
        if (c.ImapHost is null || c.ImapPort is null) return new FetchResult([], cursor);

        using var imap = new ImapClient { Timeout = 25_000 };
        try
        {
            var socket = await SafeSocket.ConnectAsync(c.ImapHost, c.ImapPort.Value, ct);
            await imap.ConnectAsync(socket, c.ImapHost, c.ImapPort.Value, ImapSecurity(c.ImapPort.Value), ct);
            await imap.AuthenticateAsync(c.Username ?? c.Address, c.Password, ct);

            var inbox = imap.Inbox;
            await inbox.OpenAsync(FolderAccess.ReadOnly, ct);

            // Cursor is "uidValidity:lastUid". If the server renumbered the mailbox, start again from the date.
            uint validity = inbox.UidValidity; uint last = 0; var reset = true;
            if (cursor is not null && cursor.Split(':') is [var v, var u] && uint.TryParse(v, out var cv) && uint.TryParse(u, out var cu) && cv == validity)
            { last = cu; reset = false; }

            IList<UniqueId> uids;
            if (reset)
            {
                var from = sinceUtc < DateTime.UtcNow.AddDays(-3) ? DateTime.UtcNow.AddDays(-3) : sinceUtc;
                uids = await inbox.SearchAsync(SearchQuery.DeliveredAfter(from.Date), ct);
                if (uids.Count > 200) uids = uids.Skip(uids.Count - 200).ToList();
            }
            else
            {
                var range = new UniqueIdRange(new UniqueId(last + 1), UniqueId.MaxValue);
                var summaries = await inbox.FetchAsync(range, MessageSummaryItems.UniqueId, ct);
                uids = summaries.Select(s => s.UniqueId).Where(id => id.Id > last).OrderBy(id => id.Id).Take(100).ToList();
            }

            var messages = new List<IncomingEmail>(); uint maxUid = last;
            foreach (var uid in uids)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    var mime = await inbox.GetMessageAsync(uid, ct);
                    var from = mime.From.Mailboxes.FirstOrDefault()?.Address?.ToLowerInvariant();
                    if (from != c.Address.ToLowerInvariant()) messages.Add(MimeSupport.Parse(mime, $"{validity}:{uid.Id}", null, null));
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogDebug(ex, "Skipped unreadable message {Uid}", uid.Id);
                }
                if (uid.Id > maxUid) maxUid = uid.Id;
            }
            if (reset && uids.Count == 0)
                maxUid = inbox.UidNext is { } next && next.Id > 0 ? next.Id - 1 : 0;

            await imap.DisconnectAsync(true, ct);
            return new FetchResult(messages, $"{validity}:{maxUid}");
        }
        catch (AuthenticationException ex) { throw new MailAuthException("The mailbox refused the username or password." + Hint(ex)); }
        catch (Exception ex) when (ex is ImapProtocolException or ImapCommandException or ServiceNotConnectedException or IOException or System.Net.Sockets.SocketException or TimeoutException)
        { throw new MailTransientException("The mail server could not be read right now: " + Short(ex.Message), ex); }
    }

    /// <summary>Checks that both servers accept the login, for the "Connect mailbox" form.</summary>
    public async Task VerifyAsync(MailCredentials c, CancellationToken ct)
    {
        using (var smtp = new SmtpClient { Timeout = 20_000 })
        {
            try
            {
                var socket = await SafeSocket.ConnectAsync(c.SmtpHost!, c.SmtpPort!.Value, ct);
                await smtp.ConnectAsync(socket, c.SmtpHost!, c.SmtpPort.Value, SmtpSecurity(c.SmtpPort.Value), ct);
                await smtp.AuthenticateAsync(c.Username ?? c.Address, c.Password, ct);
                await smtp.DisconnectAsync(true, ct);
            }
            catch (AuthenticationException ex) { throw new MailAuthException("The sending server refused the username or password." + Hint(ex)); }
            catch (Exception ex) when (ex is SmtpProtocolException or SmtpCommandException or IOException or System.Net.Sockets.SocketException or TimeoutException)
            { throw new MailTransientException($"Could not sign in to {c.SmtpHost}:{c.SmtpPort}. Check the server name and port.", ex); }
        }

        using var imap = new ImapClient { Timeout = 20_000 };
        try
        {
            var socket = await SafeSocket.ConnectAsync(c.ImapHost!, c.ImapPort!.Value, ct);
            await imap.ConnectAsync(socket, c.ImapHost!, c.ImapPort.Value, ImapSecurity(c.ImapPort.Value), ct);
            await imap.AuthenticateAsync(c.Username ?? c.Address, c.Password, ct);
            await imap.DisconnectAsync(true, ct);
        }
        catch (AuthenticationException ex) { throw new MailAuthException("The receiving server refused the username or password." + Hint(ex)); }
        catch (Exception ex) when (ex is ImapProtocolException or ImapCommandException or IOException or System.Net.Sockets.SocketException or TimeoutException)
        { throw new MailTransientException($"Could not sign in to {c.ImapHost}:{c.ImapPort}. Check the server name and port.", ex); }
    }
}
