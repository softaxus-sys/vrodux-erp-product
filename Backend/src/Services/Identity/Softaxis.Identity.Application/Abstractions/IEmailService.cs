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
}
