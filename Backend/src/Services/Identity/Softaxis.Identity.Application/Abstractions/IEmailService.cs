namespace Softaxis.Identity.Application.Abstractions;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetToken, CancellationToken ct = default);

    /// <summary>Send the email-verification link a new user must click before they can log in.</summary>
    Task SendEmailVerificationAsync(string toEmail, string toName, string verificationToken, CancellationToken ct = default);

    /// <summary>
    /// Welcome a newly-provisioned tenant owner. When <paramref name="setPasswordToken"/> is provided the
    /// email invites them to set their own password and activate the account (set-password link); otherwise
    /// it's a "your account is ready — log in" notice for an account whose password was set by the admin.
    /// </summary>
    Task SendTenantInviteEmailAsync(string toEmail, string toName, string tenantName, string? setPasswordToken, CancellationToken ct = default);

    /// <summary>
    /// Nudge a trial tenant that its free period is running out. Sent at 15 / 7 / 3 / 1 days
    /// remaining, and once more when the trial has actually lapsed (<paramref name="daysLeft"/> ≤ 0),
    /// which explains that data is retained and access resumes on subscribing.
    /// </summary>
    Task SendTrialReminderAsync(string toEmail, string toName, string tenantName, int daysLeft, string planLabel, CancellationToken ct = default);

    /// <summary>Confirm a successful payment (or a failed renewal) to the tenant owner.</summary>
    Task SendSubscriptionReceiptAsync(string toEmail, string toName, string tenantName, string planLabel, decimal amount, string currency, DateTime? nextRenewal, CancellationToken ct = default);
}
