using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.Finance.Application.Abstractions;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Reads the same shared "Email" config section the gateway already configures for Identity's
/// password-reset mail and Restaurant's receipts (SmtpHost/Port/Username/Password/FromAddress/
/// FromName) — one SMTP account per deployment, not one per service.
/// </summary>
internal sealed class SmtpFinanceEmailService(
    IConfiguration configuration, ILogger<SmtpFinanceEmailService> logger) : IFinanceEmailService
{
    public static bool IsConfigured(IConfiguration configuration)
    {
        var s = configuration.GetSection("Email");
        return !string.IsNullOrWhiteSpace(s["SmtpHost"]) && !string.IsNullOrWhiteSpace(s["SmtpUsername"]);
    }

    public async Task<bool> SendInvoiceAsync(string toEmail, string toName, IReadOnlyList<string> cc,
        string subject, string html,
        IReadOnlyList<InlineImage>? inlineImages = null,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken ct = default)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"] ?? string.Empty;
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"] ?? "Softaxis ERP";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
        {
            // Dev fallback, same as the password-reset path: log what would have gone out rather
            // than pretending it was delivered. The caller records this as NOT sent.
            logger.LogWarning("SMTP not configured. Invoice email \"{Subject}\" would have gone to {Email}.", subject, toEmail);
            return false;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
        foreach (var address in cc)
        {
            // One bad address in the CC list must not stop the tenant's own reminder going out.
            try { message.Cc.Add(MailboxAddress.Parse(address)); }
            catch (Exception ex) { logger.LogWarning(ex, "Skipping invalid CC address {Address}.", address); }
        }
        message.Subject = subject;
        message.Body = BuildBody(html, inlineImages, attachments);

        try
        {
            using var client = new SmtpClient();
            var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, socketOptions, ct);
            await client.AuthenticateAsync(username, password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            logger.LogInformation("Sent \"{Subject}\" to {Email}.", subject, toEmail);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send \"{Subject}\" to {Email}.", subject, toEmail);
            return false;
        }
    }
    /// <summary>
    /// Builds the message body, embedding any letterhead images as linked resources.
    ///
    /// A data URI in an <c>&lt;img src&gt;</c> is stripped by Gmail and blocked by Outlook, so the
    /// logo, signature and stamp have to travel as real MIME parts referenced by <c>cid:</c>.
    /// A malformed data URI is skipped rather than thrown on — a bad logo must never stop an
    /// invoice going out.
    /// </summary>
    private MimeEntity BuildBody(string html, IReadOnlyList<InlineImage>? images,
        IReadOnlyList<EmailAttachment>? attachments = null)
    {
        var builder = new BodyBuilder { HtmlBody = html };

        foreach (var image in images ?? [])
        {
            try
            {
                if (!TryParseDataUri(image.DataUri, out var mediaType, out var subType, out var bytes))
                    continue;

                var resource = builder.LinkedResources.Add($"{image.ContentId}", bytes,
                    new ContentType(mediaType, subType));
                resource.ContentId = image.ContentId;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Skipping letterhead image {ContentId}.", image.ContentId);
            }
        }

        foreach (var file in attachments ?? [])
        {
            try
            {
                var slash = file.ContentType.IndexOf('/');
                var type  = slash > 0 ? file.ContentType[..slash]      : "application";
                var sub   = slash > 0 ? file.ContentType[(slash + 1)..] : "octet-stream";
                builder.Attachments.Add(file.FileName, file.Content, new ContentType(type, sub));
            }
            catch (Exception ex)
            {
                // Same rule as the letterhead images: an attachment that cannot be built must not
                // stop the invoice reaching the customer. It is logged, and the email still goes.
                logger.LogWarning(ex, "Skipping attachment {FileName}.", file.FileName);
            }
        }

        return builder.ToMessageBody();
    }

    /// <summary>Splits "data:image/png;base64,AAAA" into its media type and bytes.</summary>
    private static bool TryParseDataUri(string uri, out string mediaType, out string subType, out byte[] bytes)
    {
        mediaType = "image"; subType = "png"; bytes = [];
        if (string.IsNullOrWhiteSpace(uri) || !uri.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return false;

        var comma = uri.IndexOf(',');
        if (comma < 0) return false;

        var header = uri[5..comma];                     // e.g. "image/png;base64"
        if (!header.Contains("base64", StringComparison.OrdinalIgnoreCase)) return false;

        var mime = header.Split(';')[0];
        var slash = mime.IndexOf('/');
        if (slash > 0)
        {
            mediaType = mime[..slash];
            subType   = mime[(slash + 1)..];
        }

        try { bytes = Convert.FromBase64String(uri[(comma + 1)..]); }
        catch (FormatException) { return false; }

        return bytes.Length > 0;
    }
}
