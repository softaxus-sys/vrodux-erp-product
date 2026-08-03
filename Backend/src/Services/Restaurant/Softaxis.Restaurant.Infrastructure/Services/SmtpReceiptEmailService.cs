using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.Restaurant.Application.Abstractions;

namespace Softaxis.Restaurant.Infrastructure.Services;

/// <summary>Reads the same shared "Email" config section the gateway already configures for Identity's
/// password-reset/verification emails (SmtpHost/Port/Username/Password/FromAddress/FromName) — one SMTP
/// account per deployment, not a separate one per service.</summary>
internal sealed class SmtpReceiptEmailService(IConfiguration configuration, ILogger<SmtpReceiptEmailService> logger)
    : IReceiptEmailService
{
    public async Task<bool> SendReceiptAsync(string toEmail, string toName, string orderNumber, string receiptHtml, CancellationToken ct = default)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"] ?? "Softaxis ERP";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
        {
            logger.LogWarning("SMTP not configured. Receipt for order {OrderNumber} would have gone to {Email}.", orderNumber, toEmail);
            return false;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = $"Your receipt — {orderNumber}";
        message.Body = new TextPart("html") { Text = receiptHtml };

        try
        {
            using var client = new SmtpClient();
            var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await client.ConnectAsync(host, port, socketOptions, ct);
            await client.AuthenticateAsync(username, password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);
            logger.LogInformation("Receipt for order {OrderNumber} emailed to {Email}.", orderNumber, toEmail);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to email receipt for order {OrderNumber} to {Email}.", orderNumber, toEmail);
            return false;
        }
    }
}
