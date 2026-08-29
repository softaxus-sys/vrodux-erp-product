using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.Users.Commands.ChangeUserEmail;

/// <summary>
/// Move an account to a different email address. Serves both cases: a user changing their own,
/// and a user administrator changing someone else's.
/// </summary>
/// <param name="CurrentPassword">
/// Required only when changing your OWN address. Email is the account-recovery channel, so a
/// hijacked session must not be able to move it silently — the same reasoning
/// <c>ChangePasswordCommand</c> uses. An administrator changing someone else's address proves
/// nothing by typing that person's password, so it is not asked for.
/// </param>
public sealed record ChangeUserEmailCommand(
    Guid    UserId,
    string  NewEmail,
    string? CurrentPassword = null
) : ICommand<ChangeEmailResultDto>;

/// <param name="RequiresVerification">
/// True when the account was left unverified and cannot sign in until the new address is
/// confirmed. False when an administrator vouched for the change.
/// </param>
/// <param name="NotificationError">
/// Why the email could not be sent, when it could not. Surfaced rather than swallowed: with
/// <c>RequiresVerification</c> set, a mail that never arrives leaves someone unable to sign in.
/// </param>
public sealed record ChangeEmailResultDto(
    Guid    UserId,
    string  Email,
    bool    RequiresVerification,
    bool    NotificationSent,
    string? NotificationError);

public sealed class ChangeUserEmailCommandValidator : AbstractValidator<ChangeUserEmailCommand>
{
    public ChangeUserEmailCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.NewEmail)
            .NotEmpty().WithMessage("A new email address is required.")
            .EmailAddress().WithMessage("That is not a valid email address.")
            .MaximumLength(254);
    }
}
