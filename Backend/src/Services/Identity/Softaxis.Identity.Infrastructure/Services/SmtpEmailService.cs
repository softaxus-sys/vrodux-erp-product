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
        if (!SmtpConfiguration.IsConfigured(section))
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
        if (!SmtpConfiguration.IsConfigured(section))
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

    public async Task SendTenantInviteEmailAsync(string toEmail, string toName, string tenantName, string? setPasswordToken, CancellationToken ct = default)
    {
        var section     = configuration.GetSection("Email");
        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var isInvite    = !string.IsNullOrWhiteSpace(setPasswordToken);
        var actionUrl   = isInvite
            ? $"{frontendUrl}/auth/reset-password?token={Uri.EscapeDataString(setPasswordToken!)}&email={Uri.EscapeDataString(toEmail)}"
            : $"{frontendUrl}/auth/login";

        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"]    ?? "Softaxis ERP";

        // Dev fallback: log to console when SMTP is not configured so the link is still usable.
        if (!SmtpConfiguration.IsConfigured(section))
        {
            logger.LogWarning("SMTP not configured. Tenant {Action} link for {Email}: {Url}",
                isInvite ? "activation" : "login", toEmail, actionUrl);
            return;
        }

        var cta  = isInvite ? "Set My Password" : "Log In";
        var lead = isInvite
            ? $"Your workspace <strong>{tenantName}</strong> is ready. Set your password to activate your account and log in. This link expires in <strong>7 days</strong>."
            : $"Your workspace <strong>{tenantName}</strong> is ready. Use the credentials shared with you to log in.";

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>Welcome to Softaxis ERP</h2>
              <p>Hi {toName},</p>
              <p>{lead}</p>
              <p style="margin:24px 0">
                <a href="{actionUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  {cta}
                </a>
              </p>
              <p>Or copy this link into your browser:<br/>
                <a href="{actionUrl}" style="color:#2563eb">{actionUrl}</a>
              </p>
              <p style="color:#64748b;font-size:12px">If you were not expecting this, you can ignore this email.</p>
            </body></html>
            """;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = isInvite ? $"Activate your {tenantName} workspace on Softaxis ERP" : $"Your {tenantName} workspace is ready";
        message.Body    = new TextPart("html") { Text = body };

        using var client = new SmtpClient();
        var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

        await client.ConnectAsync(host, port, socketOptions, ct);
        await client.AuthenticateAsync(username, password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);

        logger.LogInformation("Tenant invite email sent to {Email}", toEmail);
    }

    public async Task SendTrialReminderAsync(
        string toEmail, string toName, string tenantName, int daysLeft, string planLabel, CancellationToken ct = default)
    {
        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var billingUrl  = $"{frontendUrl}/settings/billing";
        var expired     = daysLeft <= 0;

        var subject = expired
            ? $"Your {tenantName} trial has ended — your data is safe"
            : daysLeft == 1
                ? $"Your {tenantName} trial ends tomorrow"
                : $"{daysLeft} days left in your {tenantName} trial";

        // The lapsed message leads with data retention: the single thing a customer panics about.
        var lead = expired
            ? """
              <p>Your free trial has ended, so access to the app is paused until you choose a plan.</p>
              <p><strong>Nothing has been deleted.</strong> Every record, user and setting is exactly where you
              left it, and everything comes straight back the moment you subscribe.</p>
              """
            : $"""
              <p>Your free trial ends in <strong>{daysLeft} day{(daysLeft == 1 ? "" : "s")}</strong>.</p>
              <p>Subscribe before then and you'll keep working without interruption — same data, same setup.</p>
              """;

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>{(expired ? "Your trial has ended" : "Your trial is ending soon")}</h2>
              <p>Hi {toName},</p>
              {lead}
              <p style="margin:24px 0">
                <a href="{billingUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  {(expired ? "Reactivate my account" : "Choose a plan")}
                </a>
              </p>
              <p style="color:#64748b;font-size:13px">Current plan: <strong>{planLabel}</strong>. You can change tier or
              billing period at any time.</p>
              <p style="color:#64748b;font-size:12px">Questions? Just reply to this email.</p>
            </body></html>
            """;

        await SendAsync(toEmail, toName, subject, body,
            fallbackLog: $"Trial reminder ({daysLeft}d) for {tenantName} → {billingUrl}", ct);
    }

    public async Task SendSubscriptionReceiptAsync(
        string toEmail, string toName, string tenantName, string planLabel,
        decimal amount, string currency, DateTime? nextRenewal, CancellationToken ct = default)
    {
        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";
        var billingUrl  = $"{frontendUrl}/settings/billing";

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>Payment received</h2>
              <p>Hi {toName},</p>
              <p>Thanks — your subscription for <strong>{tenantName}</strong> is active.</p>
              <table style="border-collapse:collapse;margin:20px 0;font-size:14px">
                <tr><td style="padding:6px 16px 6px 0;color:#64748b">Plan</td><td style="padding:6px 0"><strong>{planLabel}</strong></td></tr>
                <tr><td style="padding:6px 16px 6px 0;color:#64748b">Amount</td><td style="padding:6px 0"><strong>{amount:N2} {currency}</strong></td></tr>
                {(nextRenewal.HasValue
                    ? $"""<tr><td style="padding:6px 16px 6px 0;color:#64748b">Renews</td><td style="padding:6px 0">{nextRenewal.Value:d MMMM yyyy}</td></tr>"""
                    : "")}
              </table>
              <p style="margin:24px 0">
                <a href="{billingUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  View billing
                </a>
              </p>
              <p style="color:#64748b;font-size:12px">Invoices are available any time from your billing page.</p>
            </body></html>
            """;

        await SendAsync(toEmail, toName, $"Payment received — {tenantName}", body,
            fallbackLog: $"Subscription receipt for {tenantName}: {amount:N2} {currency}", ct);
    }

    /// <summary>
    /// Shared SMTP send. Mirrors the connect/auth/send/disconnect sequence used by the older
    /// methods above (465 → implicit SSL, otherwise STARTTLS) and keeps the same dev fallback:
    /// with SMTP unconfigured it logs instead of throwing, so local runs are never blocked.
    /// </summary>
    private async Task SendAsync(string toEmail, string toName, string subject, string htmlBody, string fallbackLog, CancellationToken ct)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = section["FromAddress"] ?? "noreply@softaxis.io";
        var fromName = section["FromName"]    ?? "Softaxis ERP";

        if (!SmtpConfiguration.IsConfigured(section))
        {
            logger.LogWarning("SMTP not configured. {Fallback}", fallbackLog);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;
        message.Body    = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        var socketOptions = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

        await client.ConnectAsync(host, port, socketOptions, ct);
        await client.AuthenticateAsync(username, password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);

        logger.LogInformation("Email '{Subject}' sent to {Email}", subject, toEmail);
    }

    /// <inheritdoc />
    public async Task<bool> SendEmployeeInviteEmailAsync(
        string toEmail, string toName, string workspaceName, string setPasswordToken, CancellationToken ct = default)
    {
        var section     = configuration.GetSection("Email");
        var frontendUrl = configuration["FrontendUrl"] ?? "http://localhost:5173";

        // Reuses the password-reset page and token, so there is one set-your-password flow in the
        // product rather than a second one that behaves almost the same.
        var actionUrl = $"{frontendUrl}/auth/reset-password?token={Uri.EscapeDataString(setPasswordToken)}&email={Uri.EscapeDataString(toEmail)}";

        var host     = section["SmtpHost"];
        var username = section["SmtpUsername"];

        // Not configured: log the link so it stays usable in development, and report false so the
        // caller shows a temporary password instead of claiming an email was sent.
        if (!SmtpConfiguration.IsConfigured(section))
        {
            logger.LogWarning("SMTP not configured. Employee invite link for {Email}: {Url}", toEmail, actionUrl);
            return false;
        }

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>Your {workspaceName} account is ready</h2>
              <p>Hi {toName},</p>
              <p>An account has been created for you at <strong>{workspaceName}</strong>. Set your
                 password to sign in and view your profile, request leave, mark attendance and
                 download your payslips. This link expires in <strong>7 days</strong>.</p>
              <p style="margin:24px 0">
                <a href="{actionUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
                  Set My Password
                </a>
              </p>
              <p>Or copy this link into your browser:<br/>
                <a href="{actionUrl}" style="color:#2563eb">{actionUrl}</a>
              </p>
              <p style="color:#64748b;font-size:13px">If you weren't expecting this, you can ignore this email.</p>
            </body></html>
            """;

        await SendAsync(toEmail, toName, $"Set your password — {workspaceName}", body,
            $"Employee invite link for {toEmail}: {actionUrl}", ct);
        return true;
    }

    public async Task<bool> SendEmailChangedNoticeAsync(
        string oldEmail, string toName, string newEmail, string workspaceName, CancellationToken ct = default)
    {
        var section = configuration.GetSection("Email");
        if (string.IsNullOrWhiteSpace(section["SmtpHost"]) || string.IsNullOrWhiteSpace(section["SmtpUsername"]))
        {
            logger.LogWarning("SMTP not configured. Email-change notice for {Old} -> {New} not sent.", oldEmail, newEmail);
            return false;
        }

        var body = $"""
            <html><body style="font-family:sans-serif;color:#1e293b">
              <h2>Your sign-in email was changed</h2>
              <p>Hi {toName},</p>
              <p>The email address for your <strong>{workspaceName}</strong> account was changed from
                 <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>. Sign in with the new
                 address from now on.</p>
              <p style="color:#b91c1c">If you did not make this change, contact your administrator
                 immediately — someone else may have access to your account.</p>
            </body></html>
            """;

        await SendAsync(oldEmail, toName, $"Your {workspaceName} sign-in email was changed", body,
            $"Email-change notice for {oldEmail} (new address {newEmail})", ct);
        return true;
    }
}
