using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.SetupTwoFactor;

public sealed class SetupTwoFactorCommandHandler(
    IUserRepository      userRepo,
    ITotpService         totp,
    ITotpSecretProtector protector,
    IUnitOfWork          uow)
    : ICommandHandler<SetupTwoFactorCommand, TwoFactorSetupDto>
{
    private const string Issuer = "Vrodux ERP";

    public async Task<Result<TwoFactorSetupDto>> Handle(SetupTwoFactorCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null)
            return Result.Failure<TwoFactorSetupDto>(Error.NotFoundById("User", cmd.UserId));

        var secret = totp.GenerateSecret();
        user.SetTwoFactorSecret(protector.Protect(secret));   // pending — not enabled until confirmed
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        var uri = totp.BuildOtpAuthUri(secret, user.Email.Value, Issuer);
        var qr  = totp.BuildQrCodeDataUri(uri);
        return Result.Success(new TwoFactorSetupDto(secret, uri, qr));
    }
}
