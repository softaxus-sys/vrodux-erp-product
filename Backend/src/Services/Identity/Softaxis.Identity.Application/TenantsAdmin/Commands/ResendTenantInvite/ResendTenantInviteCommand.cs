using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ResendTenantInvite;

public sealed record ResendTenantInviteResultDto(int Sent, int Failed, IReadOnlyList<string> Recipients);

/// <summary>Re-sends the activation email to every user of a tenant who has not verified yet.</summary>
public sealed record ResendTenantInviteCommand(Guid TenantId) : ICommand<ResendTenantInviteResultDto>;

public sealed class ResendTenantInviteCommandHandler(
    ITenantRepository tenantRepo,
    IUserRepository   userRepo,
    IJwtTokenService  jwtService,
    IEmailService     emailService,
    IUnitOfWork       uow,
    ILogger<ResendTenantInviteCommandHandler> logger)
    : ICommandHandler<ResendTenantInviteCommand, ResendTenantInviteResultDto>
{
    public async Task<Result<ResendTenantInviteResultDto>> Handle(ResendTenantInviteCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.TenantId, ct);
        if (tenant is null)
            return Result.Failure<ResendTenantInviteResultDto>(Error.NotFoundById("Tenant", cmd.TenantId));

        var users = await userRepo.GetUnverifiedByTenantAsync(tenant.Id, ct);
        if (users.Count == 0)
            return Result.Failure<ResendTenantInviteResultDto>(Error.Custom(
                "Tenant.Conflict", "Every user of this workspace has already activated their account."));

        // New tokens are saved before any email goes, so a link in an inbox always matches what is stored.
        var mails = new List<(string Email, string Name, string Token, bool SetPassword)>();
        foreach (var u in users)
        {
            var raw = jwtService.GenerateRefreshTokenRaw();
            // An owner invited without a password still holds a set-password token and has never
            // signed in: they get a new set-password link, which also confirms the address.
            // Everyone else chose a password and only needs to confirm the address.
            var setPassword = u.PasswordResetTokenHash is not null && u.LastLoginAt is null;
            if (setPassword) u.SetPasswordResetToken(jwtService.HashToken(raw), DateTime.UtcNow.AddDays(7));
            else             u.SetEmailVerificationToken(jwtService.HashToken(raw), DateTime.UtcNow.AddHours(48));
            userRepo.Update(u);
            mails.Add((u.Email.Value, u.FullName, raw, setPassword));
        }
        await uow.SaveChangesAsync(ct);

        int sent = 0, failed = 0;
        var recipients = new List<string>();
        foreach (var m in mails)
        {
            try
            {
                if (m.SetPassword)
                    await emailService.SendTenantInviteEmailAsync(m.Email, m.Name, tenant.Name, m.Token, ct);
                else
                    await emailService.SendEmailVerificationAsync(m.Email, m.Name, m.Token, ct);
                sent++;
                recipients.Add(m.Email);
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogError(ex, "Re-invite email failed for {Email} (tenant {TenantId})", m.Email, tenant.Id);
            }
        }

        if (sent == 0)
            return Result.Failure<ResendTenantInviteResultDto>(Error.Custom(
                "Email.Failed", "The activation email could not be sent. Check the mail server settings and try again."));

        return Result.Success(new ResendTenantInviteResultDto(sent, failed, recipients));
    }
}
