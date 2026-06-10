namespace Softaxis.Identity.Application.Abstractions;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string toName, string resetToken, CancellationToken ct = default);
}
