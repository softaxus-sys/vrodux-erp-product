using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.ResetPassword;

public sealed class ResetPasswordCommandHandler(
    IUserRepository  userRepo,
    IJwtTokenService jwtService,
    IPasswordHasher  passwordHasher,
    IAuditLogRepository auditRepo,
    IUnitOfWork      uow)
    : ICommandHandler<ResetPasswordCommand>
{
    public async Task<Result> Handle(ResetPasswordCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(cmd.Email, ct);
        if (user is null)
            return Result.Failure(Error.Custom("Auth.ResetPassword.Invalid", "Invalid or expired reset token."));

        var tokenHash = jwtService.HashToken(cmd.Token);

        if (!user.IsPasswordResetTokenValid(tokenHash))
            return Result.Failure(Error.Custom("Auth.ResetPassword.Invalid", "Invalid or expired reset token."));

        var newHash = passwordHasher.Hash(cmd.NewPassword);
        user.ChangePassword(newHash);
        user.ClearPasswordResetToken();
        if (user.IsLocked) user.Unlock();
        userRepo.Update(user);

        auditRepo.Add(new Domain.Entities.AuditLog(
            user.Id, "PASSWORD_RESET", "User", user.Id.ToString(),
            null, null, null, null, true, user.TenantId));

        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
