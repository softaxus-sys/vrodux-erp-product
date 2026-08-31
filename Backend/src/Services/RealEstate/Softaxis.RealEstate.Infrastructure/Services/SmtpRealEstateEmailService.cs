using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.RealEstate.Application.Abstractions;

namespace Softaxis.RealEstate.Infrastructure.Services;

/// <summary>
/// Reads the same shared "Email" config section the gateway already configures for Identity's
/// password-reset mail and Restaurant's receipts (SmtpHost/Port/Username/Password/FromAddress/
/// FromName) — one SMTP account per deployment, not one per service.
/// </summary>
internal sealed class SmtpRealEstateEmailService(
    IConfiguration configuration, ILogger<SmtpRealEstateEmailService> logger) : IRealEstateEmailService
{
    public static bool IsConfigured(IConfiguration configuration)
    {
        var s = configuration.GetSection("Email");
        return !string.IsNullOrWhiteSpace(s["SmtpHost"]) && !string.IsNullOrWhiteSpace(s["SmtpUsername"]);
    }

    public async Task<bool> SendAsync(string toEmail, string toName, IReadOnlyList<string> cc,
        string subject, string html, CancellationToken ct = default)
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
            logger.LogWarning("SMTP not configured. Notice \"{Subject}\" would have gone to {Email}.", subject, toEmail);
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
        message.Body = new TextPart("html") { Text = html };

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
}
