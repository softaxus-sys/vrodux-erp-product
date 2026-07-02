namespace Softaxis.Identity.Application.Abstractions;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetToken, CancellationToken ct = default);

    /// <summary>Send the email-verification link a new user must click before they can log in.</summary>
    Task SendEmailVerificationAsync(string toEmail, string toName, string verificationToken, CancellationToken ct = default);
}
