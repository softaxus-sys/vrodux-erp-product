using System.Security.Cryptography;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.EnableTwoFactor;

public sealed class EnableTwoFactorCommandHandler(
    IUserRepository      userRepo,
    ITotpService         totp,
    ITotpSecretProtector protector,
    IUnitOfWork          uow)
    : ICommandHandler<EnableTwoFactorCommand, TwoFactorEnableResultDto>
{
    private const int BackupCodeCount = 10;

    public async Task<Result<TwoFactorEnableResultDto>> Handle(EnableTwoFactorCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null)
            return Result.Failure<TwoFactorEnableResultDto>(Error.NotFoundById("User", cmd.UserId));

        if (string.IsNullOrEmpty(user.TwoFactorSecret))
            return Result.Failure<TwoFactorEnableResultDto>(
                Error.Custom("TwoFactor.NotStarted", "Start two-factor setup before enabling it."));

        var secret = protector.Unprotect(user.TwoFactorSecret);
        if (!totp.VerifyCode(secret, (cmd.Code ?? string.Empty).Trim()))
            return Result.Failure<TwoFactorEnableResultDto>(
                Error.Custom("TwoFactor.InvalidCode", "That code is incorrect or expired. Try again."));

        var backupCodes = GenerateBackupCodes(BackupCodeCount);
        user.EnableTwoFactor(backupCodes.Select(BackupCodeHasher.Hash));
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new TwoFactorEnableResultDto(backupCodes));
    }

    /// <summary>10 random 10-character codes formatted "xxxxx-xxxxx" (Crockford-ish, no ambiguous chars).</summary>
    private static IReadOnlyList<string> GenerateBackupCodes(int count)
    {
        const string alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1
        var codes = new List<string>(count);
        for (var i = 0; i < count; i++)
        {
            var chars = new char[10];
            for (var j = 0; j < chars.Length; j++)
                chars[j] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
            codes.Add($"{new string(chars, 0, 5)}-{new string(chars, 5, 5)}");
        }
        return codes;
    }
}
