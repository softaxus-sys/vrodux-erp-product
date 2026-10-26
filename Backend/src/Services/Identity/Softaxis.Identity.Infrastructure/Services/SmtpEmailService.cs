using Softaxis.BuildingBlocks.Infrastructure.Email;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Softaxis.Identity.Application.Abstractions;
using static Softaxis.BuildingBlocks.Infrastructure.Email.BrandedEmail;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Identity's system emails. Every one is rendered through <see cref="BrandedEmail"/> so account,
/// security and billing mail all look the same and none of them is a bare paragraph and a link.
/// </summary>
public sealed class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    : IEmailService
{
    private string FrontendUrl => (configuration["FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');

    public async Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetToken, CancellationToken ct = default)
    {
        var resetUrl = $"{FrontendUrl}/auth/reset-password?token={Uri.EscapeDataString(resetToken)}&email={Uri.EscapeDataString(toEmail)}";

        var body = Render(
            title: "Reset your password",
            preheader: "Use this link within 60 minutes to choose a new password.",
            bodyHtml:
                P($"Hi {B(toName)},") +
                P("We received a request to reset the password for your Vrodux ERP account. Choose a new one with the button below. " +
                  "For your security this link works once and expires in <strong>60 minutes</strong>."),
            ctaText: "Reset my password",
            ctaUrl: resetUrl,
            note: "<strong>Didn't ask for this?</strong> You can ignore this email &mdash; your password won't change unless the link is used.",
            tone: EmailTone.Warning,
            footerNote: "You received this because a password reset was requested for this address.");

        await SendAsync(toEmail, toName, "Reset your Vrodux ERP password", body,
            $"Password reset link for {toEmail}: {resetUrl}", ct);
    }

    public async Task SendEmailVerificationAsync(string toEmail, string toName, string verificationToken, CancellationToken ct = default)
    {
        var verifyUrl = $"{FrontendUrl}/auth/verify-email?token={Uri.EscapeDataString(verificationToken)}&email={Uri.EscapeDataString(toEmail)}";

        var body = Render(
            title: "Verify your email address",
            preheader: "One click to activate your Vrodux ERP account.",
            bodyHtml:
                P($"Hi {B(toName)},") +
                P("An account has been created for you on Vrodux ERP. Confirm that this is your email address to activate the account and sign in.") +
                P("This link expires in <strong>48 hours</strong>."),
            ctaText: "Verify my email",
            ctaUrl: verifyUrl,
            details:
            [
                new("Account", toEmail),
            ],
            tone: EmailTone.Info,
            footerNote: "If you weren't expecting this account, you can safely ignore this email.");

        await SendAsync(toEmail, toName, "Verify your Vrodux ERP email", body,
            $"Email verification link for {toEmail}: {verifyUrl}", ct);
    }

    public async Task SendTenantInviteEmailAsync(string toEmail, string toName, string tenantName, string? setPasswordToken, CancellationToken ct = default)
    {
        var isInvite  = !string.IsNullOrWhiteSpace(setPasswordToken);
        var actionUrl = isInvite
            ? $"{FrontendUrl}/auth/reset-password?token={Uri.EscapeDataString(setPasswordToken!)}&email={Uri.EscapeDataString(toEmail)}"
            : $"{FrontendUrl}/auth/login";

        var lead = isInvite
            ? P($"Your workspace {B(tenantName)} is ready. Set a password to activate your account and sign in.") +
              P("This link expires in <strong>7 days</strong>.")
            : P($"Your workspace {B(tenantName)} is ready. Sign in with the credentials your administrator shared with you.");

        var body = Render(
            title: $"Welcome to Vrodux ERP",
            preheader: isInvite ? $"Set your password to open {tenantName}." : $"{tenantName} is ready to use.",
            bodyHtml: P($"Hi {B(toName)},") + lead,
            ctaText: isInvite ? "Set my password" : "Sign in",
            ctaUrl: actionUrl,
            details:
            [
                new("Workspace", tenantName),
                new("Sign-in email", toEmail),
            ],
            tone: EmailTone.Success,
            footerNote: "If you weren't expecting this, you can ignore this email.");

        await SendAsync(toEmail, toName,
            isInvite ? $"Activate your {tenantName} workspace on Vrodux ERP" : $"Your {tenantName} workspace is ready",
            body, $"Tenant {(isInvite ? "activation" : "login")} link for {toEmail}: {actionUrl}", ct);
    }

    public async Task SendTrialReminderAsync(
        string toEmail, string toName, string tenantName, int daysLeft, string planLabel, CancellationToken ct = default)
    {
        var billingUrl = $"{FrontendUrl}/settings/billing";
        var expired    = daysLeft <= 0;

        var subject = expired
            ? $"Your {tenantName} trial has ended — your data is safe"
            : daysLeft == 1
                ? $"Your {tenantName} trial ends tomorrow"
                : $"{daysLeft} days left in your {tenantName} trial";

        // The lapsed message leads with data retention: the single thing a customer panics about.
        var lead = expired
            ? P("Your free trial has ended, so access to the app is paused until you choose a plan.")
            : P($"Your free trial for {B(tenantName)} ends in <strong>{daysLeft} day{(daysLeft == 1 ? "" : "s")}</strong>. " +
                "Subscribe before then and you'll keep working without interruption &mdash; same data, same setup.");

        var body = Render(
            title: expired ? "Your trial has ended" : "Your trial is ending soon",
            preheader: expired ? "Nothing has been deleted — subscribe to pick up where you left off." : $"{daysLeft} day{(daysLeft == 1 ? "" : "s")} left to choose a plan.",
            bodyHtml: P($"Hi {B(toName)},") + lead,
            ctaText: expired ? "Reactivate my account" : "Choose a plan",
            ctaUrl: billingUrl,
            details:
            [
                new("Workspace", tenantName),
                new("Current plan", planLabel),
                new("Trial", expired ? "Ended" : $"{daysLeft} day{(daysLeft == 1 ? "" : "s")} left"),
            ],
            note: expired
                ? "<strong>Nothing has been deleted.</strong> Every record, user and setting is exactly where you left it, and everything comes straight back the moment you subscribe."
                : "You can change tier or billing period at any time from your billing page.",
            tone: expired ? EmailTone.Warning : EmailTone.Info,
            footerNote: "Questions? Just reply to this email.");

        await SendAsync(toEmail, toName, subject, body,
            $"Trial reminder ({daysLeft}d) for {tenantName} → {billingUrl}", ct);
    }

    public async Task SendSubscriptionReceiptAsync(
        string toEmail, string toName, string tenantName, string planLabel,
        decimal amount, string currency, DateTime? nextRenewal, CancellationToken ct = default)
    {
        var billingUrl = $"{FrontendUrl}/settings/billing";

        var details = new List<EmailDetail>
        {
            new("Workspace", tenantName),
            new("Plan", planLabel),
            new("Amount paid", $"{amount:N2} {currency}"),
        };
        if (nextRenewal.HasValue) details.Add(new("Renews on", nextRenewal.Value.ToString("d MMMM yyyy")));

        var body = Render(
            title: "Payment received",
            preheader: $"Thanks — {tenantName} is active on {planLabel}.",
            bodyHtml:
                P($"Hi {B(toName)},") +
                P($"Thank you &mdash; your subscription for {B(tenantName)} is active."),
            ctaText: "View billing",
            ctaUrl: billingUrl,
            details: details,
            tone: EmailTone.Success,
            footerNote: "Invoices are available any time from your billing page.");

        await SendAsync(toEmail, toName, $"Payment received — {tenantName}", body,
            $"Subscription receipt for {tenantName}: {amount:N2} {currency}", ct);
    }

    /// <summary>
    /// Shared SMTP send (465 → implicit SSL, otherwise STARTTLS). With SMTP unconfigured it logs
    /// the fallback line — which carries the link — instead of throwing, so local runs are never blocked.
    /// </summary>
    private async Task SendAsync(string toEmail, string toName, string subject, string htmlBody, string fallbackLog, CancellationToken ct)
    {
        var section  = configuration.GetSection("Email");
        var host     = section["SmtpHost"];
        var port     = int.Parse(section["SmtpPort"] ?? "587");
        var username = section["SmtpUsername"];
        var password = section["SmtpPassword"];
        var fromAddr = EmailSender.Address(section["FromAddress"]);
        var fromName = EmailSender.Name(section["FromName"]);

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
        var section = configuration.GetSection("Email");

        // Reuses the password-reset page and token, so there is one set-your-password flow in the
        // product rather than a second one that behaves almost the same.
        var actionUrl = $"{FrontendUrl}/auth/reset-password?token={Uri.EscapeDataString(setPasswordToken)}&email={Uri.EscapeDataString(toEmail)}";

        // Not configured: log the link so it stays usable in development, and report false so the
        // caller shows a temporary password instead of claiming an email was sent.
        if (!SmtpConfiguration.IsConfigured(section))
        {
            logger.LogWarning("SMTP not configured. Employee invite link for {Email}: {Url}", toEmail, actionUrl);
            return false;
        }

        var body = Render(
            title: $"Your {workspaceName} account is ready",
            preheader: "Set your password to sign in.",
            bodyHtml:
                P($"Hi {B(toName)},") +
                P($"An account has been created for you at {B(workspaceName)}. Set your password to sign in, view your profile, " +
                  "request leave, mark attendance and download your payslips.") +
                P("This link expires in <strong>7 days</strong>."),
            ctaText: "Set my password",
            ctaUrl: actionUrl,
            details:
            [
                new("Workspace", workspaceName),
                new("Sign-in email", toEmail),
            ],
            tone: EmailTone.Success,
            footerNote: "If you weren't expecting this, you can ignore this email.");

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

        var body = Render(
            title: "Your sign-in email was changed",
            preheader: $"Your {workspaceName} account now signs in with {newEmail}.",
            bodyHtml:
                P($"Hi {B(toName)},") +
                P($"The email address for your {B(workspaceName)} account has been changed. Sign in with the new address from now on."),
            details:
            [
                new("Previous email", oldEmail),
                new("New email", newEmail),
                new("Workspace", workspaceName),
            ],
            note: "<strong>Didn't make this change?</strong> Contact your administrator immediately &mdash; someone else may have access to your account.",
            tone: EmailTone.Danger,
            footerNote: "This notice was sent to your previous address so you can spot a change you didn't make.");

        await SendAsync(oldEmail, toName, $"Your {workspaceName} sign-in email was changed", body,
            $"Email-change notice for {oldEmail} (new address {newEmail})", ct);
        return true;
    }

    public async Task<bool> SendSyncAlertAsync(
        string toEmail, string workspaceName, bool recovered, int consecutiveFailures, string? error,
        CancellationToken ct = default)
    {
        var section = configuration.GetSection("Email");
        if (string.IsNullOrWhiteSpace(section["SmtpHost"]) || string.IsNullOrWhiteSpace(section["SmtpUsername"]))
        {
            logger.LogWarning(
                "SMTP not configured. Cloud-sync alert for {Workspace} not sent ({State}).",
                workspaceName, recovered ? "recovered" : "failing");
            return false;
        }

        var subject = recovered
            ? $"Cloud sync is working again - {workspaceName}"
            : $"Cloud sync has failed - {workspaceName}";

        // The message says what it means for the business, not just that a job failed: the shop is
        // trading normally and nothing is lost, but the cloud copy is going stale. Without that, the
        // natural reading of "sync failed" is that something is broken in the shop.
        var body = recovered
            ? Render(
                title: "Cloud sync is working again",
                preheader: $"{workspaceName} is up to date in the cloud.",
                bodyHtml:
                    P($"The nightly push for {B(workspaceName)} has completed successfully after {consecutiveFailures} failed attempt(s).") +
                    P("The cloud copy is up to date. Nothing was lost &mdash; each run resumes from the last confirmed batch."),
                tone: EmailTone.Success,
                footerNote: "Operator notice for this installation.")
            : Render(
                title: "Cloud sync has failed",
                preheader: "The shop is trading normally; the cloud copy is going stale.",
                bodyHtml:
                    P($"The nightly push for {B(workspaceName)} has now failed {consecutiveFailures} time(s) in a row.") +
                    P("<strong>The shop is trading normally and no data has been lost</strong> &mdash; the installation is the system of record. " +
                      "What is affected is the cloud copy, which is no longer being updated and will keep going stale until this is fixed.") +
                    "<p style=\"margin:0 0 6px;font-size:12px;color:#64748b\">What the sync reported</p>" +
                    $"<pre style=\"margin:0 0 14px;background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:8px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word\">{E(error ?? "No detail recorded.")}</pre>" +
                    P("Check the Cloud Sync screen on the installation for the full history."),
                tone: EmailTone.Danger,
                footerNote: "Operator notice for this installation.");

        await SendAsync(toEmail, "Operator", subject, body, $"Cloud-sync alert for {workspaceName}", ct);
        return true;
    }
}
