using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.DisableTwoFactor;

public sealed class DisableTwoFactorCommandHandler(
    IUserRepository      userRepo,
    ITotpService         totp,
    ITotpSecretProtector protector,
    IUnitOfWork          uow)
    : ICommandHandler<DisableTwoFactorCommand>
{
    public async Task<Result> Handle(DisableTwoFactorCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null)
            return Result.Failure(Error.NotFoundById("User", cmd.UserId));

        if (!user.TwoFactorEnabled)
            return Result.Success();   // already off — idempotent

        var code = (cmd.Code ?? string.Empty).Trim();
        var secret = string.IsNullOrEmpty(user.TwoFactorSecret) ? null : protector.Unprotect(user.TwoFactorSecret);
        var ok = (secret is not null && totp.VerifyCode(secret, code)) || user.ConsumeBackupCode(BackupCodeHasher.Hash(code));
        if (!ok)
            return Result.Failure(Error.Custom("TwoFactor.InvalidCode", "Enter a current authenticator or backup code to disable 2FA."));

        user.DisableTwoFactor();
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
