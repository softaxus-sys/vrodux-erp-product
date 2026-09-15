using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DeviceTokens.Commands;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Handlers.DeviceTokens;

internal sealed class RegisterDeviceTokenCommandHandler(IdentityDbContext db)
    : ICommandHandler<RegisterDeviceTokenCommand>
{
    public async Task<Result> Handle(RegisterDeviceTokenCommand cmd, CancellationToken ct)
    {
        var token = cmd.ExpoPushToken.Trim();
        if (token.Length == 0)
            return Result.Failure(Error.Custom("DeviceToken.Invalid", "A push token is required."));

        // The token — not the device — is the identity here: re-registering an existing one (same
        // phone re-logging in, or a different user on a shared device) updates the row in place
        // rather than creating a duplicate the unique index would reject anyway.
        var existing = await db.UserDeviceTokens.FirstOrDefaultAsync(t => t.ExpoPushToken == token, ct);
        if (existing is not null)
            existing.ReRegister(cmd.UserId, cmd.Platform, cmd.DeviceName);
        else
            db.UserDeviceTokens.Add(new UserDeviceToken(cmd.UserId, token, cmd.Platform, cmd.DeviceName));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
