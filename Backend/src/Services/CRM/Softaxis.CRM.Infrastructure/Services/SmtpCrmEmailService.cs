using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.CRM.Application.Abstractions;

namespace Softaxis.CRM.Infrastructure.Services;

/// <summary>
/// Reads the shared "Email" config section the gateway already configures for Identity, Restaurant and
/// Real Estate (SmtpHost/Port/Username/Password/FromAddress/FromName) — one SMTP account per deployment.
/// </summary>
internal sealed class SmtpCrmEmailService(
    IConfiguration configuration, ILogger<SmtpCrmEmailService> logger) : ICrmEmailService
{
    public async Task<bool> SendAsync(string toEmail, string toName, string subject, string html, CancellationToken ct = default)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.TryParse(section["SmtpPort"], out var p) ? p : 587;
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"] ?? string.Empty;
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"] ?? "Softaxis ERP";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
        {
            logger.LogWarning("SMTP not configured. Email \"{Subject}\" would have gone to {Email}.", subject, toEmail);
            return false;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromAddr));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;
            message.Body = new TextPart("html") { Text = html };

            using var client = new SmtpClient();
            var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, socketOptions, ct);
            await client.AuthenticateAsync(username, password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send \"{Subject}\" to {Email}.", subject, toEmail);
            return false;
        }
    }
}
