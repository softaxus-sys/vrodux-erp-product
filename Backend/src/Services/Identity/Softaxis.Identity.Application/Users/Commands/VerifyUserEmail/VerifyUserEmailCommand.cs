using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.VerifyUserEmail;

/// <summary>
/// An administrator confirms a user's email address on their behalf, so the account can log in
/// without the verification link.
///
/// <para>
/// Admin-created users stay <c>PendingVerification</c> until they click an emailed link, and
/// <c>LoginCommandHandler</c> refuses an unverified account. That is right when mail works — but
/// an on-premises installation with no SMTP configured can never send the link, so the account is
/// unreachable and only a database edit would free it. Sites also routinely have staff with no
/// working mailbox at all: a till operator, a warehouse picker.
/// </para>
///
/// <para>
/// The admin vouching for the person is the verification. They created the account and they know
/// who is standing in front of them, which is a stronger signal than a click in a mailbox.
/// </para>
/// </summary>
public sealed record VerifyUserEmailCommand(Guid UserId) : ICommand<UserDto>;
