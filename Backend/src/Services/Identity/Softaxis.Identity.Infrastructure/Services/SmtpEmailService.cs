using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

public sealed class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    : IEmailService
{
    public async Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetToken, CancellationToken ct = default)
    {
        var section      = configuration.GetSection("Email");
        var frontendUrl  = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var resetUrl     = $"{frontendUrl}/auth/reset-password?token={Uri.EscapeDataString(resetToken)}&email={Uri.EscapeDataString(toEmail)}";

        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"]    ?? "Softaxis ERP";

        // Dev fallback: log to console when SMTP is not configured
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
        {
            logger.LogWarning(
                "SMTP not configured. Password reset link for {Email}: {Url}",
                toEmail, resetUrl);
            return;
        }

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>Password Reset Request</h2>
              <p>Hi {toName},</p>
              <p>You requested a password reset for your Softaxis ERP account. Click the button below to set a new password. This link expires in <strong>60 minutes</strong>.</p>
              <p style="margin:24px 0">
                <a href="{resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  Reset My Password
                </a>
              </p>
              <p>Or copy this link into your browser:<br/>
                <a href="{resetUrl}" style="color:#2563eb">{resetUrl}</a>
              </p>
              <p style="color:#64748b;font-size:12px">If you did not request a password reset, you can safely ignore this email.</p>
            </body></html>
            """;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = "Reset your Softaxis ERP password";
        message.Body    = new TextPart("html") { Text = body };

        using var client = new SmtpClient();

        // Port 465 → implicit SSL, port 587 → STARTTLS
        var socketOptions = port == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;

        await client.ConnectAsync(host, port, socketOptions, ct);
        await client.AuthenticateAsync(username, password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);

        logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }

    public async Task SendEmailVerificationAsync(string toEmail, string toName, string verificationToken, CancellationToken ct = default)
    {
        var section     = configuration.GetSection("Email");
        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var verifyUrl   = $"{frontendUrl}/auth/verify-email?token={Uri.EscapeDataString(verificationToken)}&email={Uri.EscapeDataString(toEmail)}";

        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"]    ?? "Softaxis ERP";

        // Dev fallback: log to console when SMTP is not configured so the link is still usable.
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username))
        {
            logger.LogWarning("SMTP not configured. Email verification link for {Email}: {Url}", toEmail, verifyUrl);
            return;
        }

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>Verify your email</h2>
              <p>Hi {toName},</p>
              <p>An account has been created for you on Softaxis ERP. Please verify your email address to activate
                 your account and log in. This link expires in <strong>48 hours</strong>.</p>
              <p style="margin:24px 0">
                <a href="{verifyUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  Verify My Email
                </a>
              </p>
              <p>Or copy this link into your browser:<br/>
                <a href="{verifyUrl}" style="color:#2563eb">{verifyUrl}</a>
              </p>
              <p style="color:#64748b;font-size:12px">If you were not expecting this account, you can ignore this email.</p>
            </body></html>
            """;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = "Verify your Softaxis ERP email";
        message.Body    = new TextPart("html") { Text = body };

        using var client = new SmtpClient();
        var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

        await client.ConnectAsync(host, port, socketOptions, ct);
        await client.AuthenticateAsync(username, password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);

        logger.LogInformation("Email verification sent to {Email}", toEmail);
    }
}
