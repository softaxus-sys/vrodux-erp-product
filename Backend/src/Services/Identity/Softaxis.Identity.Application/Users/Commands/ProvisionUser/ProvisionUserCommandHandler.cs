using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;
using Softaxis.Identity.Domain.ValueObjects;

namespace Softaxis.Identity.Application.Users.Commands.ProvisionUser;

public sealed class ProvisionUserCommandHandler(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    IPasswordHasher passwordHasher,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    ITenantRepository tenantRepo,
    IJwtTokenService  jwt,
    IEmailService     email,
    ILogger<ProvisionUserCommandHandler> logger,
    IUnitOfWork     uow)
    : ICommandHandler<ProvisionUserCommand, ProvisionedUserDto>
{
    /// <summary>Must match the name seeded by ModuleRoleCatalogue for the HR module.</summary>
    private const string SelfServiceRoleName = "Employee (Self-Service)";

    public async Task<Result<ProvisionedUserDto>> Handle(ProvisionUserCommand cmd, CancellationToken ct)
    {
        // UsersController is [Authorize]-only, so an endpoint that mints logins enforces its own.
        //
        // Either key is accepted: user administrators create logins as part of their job, and HR
        // needs to hand an employee portal access without also gaining the ability to mint
        // arbitrary administrators.
        if (!currentUser.IsSuperAdmin
            && !currentUser.HasPermission("settings.users.create")
            && !currentUser.HasPermission("hr.employees.create-login"))
            return Result.Failure<ProvisionedUserDto>(Error.Custom(
                "Permission.Denied", "You do not have permission to create logins."));

        // Email identifies a login across the WHOLE platform — sign-in resolves an account by
        // address alone, with no workspace to disambiguate it — so this check is deliberately not
        // tenant-scoped. The message says so, because the address may well be invisible to the
        // caller: HR searches its own workspace, finds nothing, and would otherwise be told the
        // address is taken by something it cannot see.
        // A provisioned login is a real user on the tenant's plan, so it consumes a seat exactly
        // as one created from Settings does. Without this, HR could walk past the limit that screen
        // enforces — the same rule with only one of its two implementations present.
        if (await PlanSeatGuard.CheckAsync(userRepo, currentUser, tenantContext, ct) is { } seatError)
            return Result.Failure<ProvisionedUserDto>(seatError);

        if (await userRepo.EmailExistsAsync(cmd.Email, ct))
            return Result.Failure<ProvisionedUserDto>(Error.Custom("User.Email.Taken",
                "This email already has a Vrodux login, in this or another workspace. An address can only belong to one login — use a different address for this employee."));

        if (await userRepo.UsernameExistsAsync(cmd.Username, ct))
            return Result.Failure<ProvisionedUserDto>(
                Error.Custom("User.Username.Taken", "Username is already taken."));

        var temporaryPassword = GenerateTemporaryPassword();

        var created = User.Create(
            cmd.Email, cmd.Username, cmd.FirstName, cmd.LastName,
            passwordHasher.Hash(temporaryPassword));
        if (created.IsFailure) return Result.Failure<ProvisionedUserDto>(created.Error);

        var user = created.Value;

        // The tenant comes from the caller, never the request.
        var tenantId = tenantContext.TenantId;
        if (tenantId is null)
            return Result.Failure<ProvisionedUserDto>(
                Error.Custom("Tenant.Unresolved", "No tenant context for this request."));

        user.SetTenant(tenantId.Value);

        // Verified up front: the administrator handing over the password is the verification, and
        // without this the account would be blocked at login by the email-verification gate.
        user.VerifyEmail();
        user.RequirePasswordChange();

        var assigned = 0;
        foreach (var roleId in cmd.RoleIds.Distinct())
        {
            var role = await roleRepo.GetByIdAsync(roleId, ct);
            // Roles are tenant-owned: silently ignoring another tenant's id keeps this from
            // becoming a way to attach a foreign role.
            if (role is null || role.TenantId != tenantId) continue;
            user.AssignRole(roleId);
            assigned++;
        }

        // A login with no role can sign in and see nothing, which reads as a broken account. When
        // the caller picked none, fall back to self-service: the least that is still useful, and
        // exactly what an employee being given portal access needs.
        if (assigned == 0)
        {
            var selfService = await roleRepo.GetByNameAsync(SelfServiceRoleName, tenantId, ct);
            if (selfService is not null) user.AssignRole(selfService.Id);
        }

        // An invite lets the person choose their own password, so it is never seen by anyone
        // else. The token is the same single-use, hashed-at-rest one the reset flow uses.
        string? inviteToken = null;
        if (cmd.SendInvite)
        {
            var raw = jwt.GenerateRefreshTokenRaw();
            user.SetPasswordResetToken(jwt.HashToken(raw), DateTime.UtcNow.AddDays(7));
            inviteToken = raw;
        }

        userRepo.Add(user);
        await uow.SaveChangesAsync(ct);

        // Sent after the commit: an account that exists without its invite can be re-invited,
        // whereas an invite for an account that failed to save is a dead link.
        var inviteSent = false;
        string? inviteError = null;
        if (inviteToken is not null)
        {
            try
            {
                var tenant    = await tenantRepo.GetByIdAsync(tenantId.Value, ct);
                var workspace = tenant?.Name ?? "Vrodux ERP";
                inviteSent = await email.SendEmployeeInviteEmailAsync(
                    cmd.Email, $"{cmd.FirstName} {cmd.LastName}".Trim(), workspace, inviteToken, ct);

                if (!inviteSent)
                    inviteError = "SMTP is not configured on this server (Email:SmtpHost / Email:SmtpUsername).";
            }
            catch (Exception ex)
            {
                // Never fail the creation over a mail problem — the fallback below covers it.
                logger.LogWarning(ex, "Employee invite email failed for {Email}", cmd.Email);
                inviteError = ex.Message;
            }
        }

        var saved = await userRepo.GetByIdAsync(user.Id, ct) ?? user;

        // The password is withheld only when the invite genuinely went out. If it did not, it is
        // returned so the administrator still has a way to hand the account over.
        return Result.Success(new ProvisionedUserDto(
            UserDtoMapper.ToDto(saved),
            inviteSent ? null : temporaryPassword,
            inviteSent,
            inviteError));
    }


    /// <summary>
    /// 12 characters from an unambiguous alphabet — no O/0 or l/1, because this gets read aloud or
    /// copied off a screen. Uses the cryptographic RNG, not Random.
    /// </summary>
    private static string GenerateTemporaryPassword()
    {
        const string upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnpqrstuvwxyz";
        const string digit = "23456789";
        const string symbol = "!@#$%*?";
        var all = upper + lower + digit + symbol;

        // One of each class first, so the result always satisfies a standard complexity policy.
        var chars = new List<char>
        {
            Pick(upper), Pick(lower), Pick(digit), Pick(symbol),
        };
        while (chars.Count < 12) chars.Add(Pick(all));

        // Fisher-Yates with the crypto RNG — otherwise the first four positions are predictable.
        for (var i = chars.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string([.. chars]);

        static char Pick(string set) => set[RandomNumberGenerator.GetInt32(set.Length)];
    }
}
