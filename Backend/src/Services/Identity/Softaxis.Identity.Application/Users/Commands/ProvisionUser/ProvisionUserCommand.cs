using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.ProvisionUser;

/// <summary>
/// Creates a login for someone an administrator is standing in front of — typically HR giving a
/// new employee portal access.
///
/// <para>Deliberately separate from <see cref="CreateUser.CreateUserCommand"/>, which sends an
/// email-verification link and blocks login until it is clicked. That flow is right for a
/// colleague with a mailbox and wrong for the staff this exists for: warehouse, site and retail
/// employees frequently have no work email at all, so a verification round-trip would leave an
/// account nobody can ever sign into.</para>
///
/// <para>Two ways to hand the account over, because both situations are real:</para>
/// <list type="bullet">
///   <item><b>Invite</b> (<paramref name="SendInvite"/> true, the default) — emails a
///     set-your-own-password link. Nobody but the owner ever knows the password, which is why
///     it is the default.</item>
///   <item><b>Temporary password</b> — returned once for the administrator to hand over in
///     person. The only option for staff with no working mailbox.</item>
/// </list>
/// </summary>
public sealed record ProvisionUserCommand(
    string     Email,
    string     Username,
    string     FirstName,
    string     LastName,
    List<Guid> RoleIds,
    bool       SendInvite = true) : ICommand<ProvisionedUserDto>;

/// <param name="TemporaryPassword">
/// Shown to the administrator once and never stored in readable form — only its hash is kept.
/// Null when an invite was emailed instead, so the password stays known only to its owner.
/// </param>
/// <param name="InviteSent">
/// True when the set-password email was actually dispatched. False means the invite could not be
/// sent (SMTP unconfigured, or the send failed), in which case <paramref name="TemporaryPassword"/>
/// is populated as the fallback — the account is never left unreachable.
/// </param>
/// <param name="InviteError">
/// Why the invite could not be sent, when it could not. Surfaced to the administrator rather than
/// only logged: they are standing in front of the employee, and "it did not send" without a reason
/// turns a two-minute fix into a support ticket.
/// </param>
public sealed record ProvisionedUserDto(
    UserDto User,
    string? TemporaryPassword,
    bool    InviteSent,
    string? InviteError = null);
