using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.Support.Application.Abstractions;

namespace Softaxis.Support.Infrastructure.Services;

/// <summary>
/// Reads the same shared "Email" config section the gateway already configures for Identity's
/// password-reset mail, Restaurant's receipts, and Real Estate's rent reminders — one SMTP
/// account per deployment, not one per service.
/// </summary>
internal sealed class SmtpSupportEmailService(
    IConfiguration configuration, ILogger<SmtpSupportEmailService> logger) : ISupportEmailService
{
    public async Task<bool> SendAsync(string toEmail, string toName, string subject, string html,
        CancellationToken ct = default)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"] ?? string.Empty;
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"] ?? "Softaxis ERP";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(toEmail))
        {
            // Dev fallback, same as every other service's email path: log what would have gone
            // out rather than pretending it was delivered. The caller records this as NOT sent.
            logger.LogWarning("SMTP not configured (or no recipient address). Notice \"{Subject}\" would have gone to {Email}.", subject, toEmail);
            return false;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
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
