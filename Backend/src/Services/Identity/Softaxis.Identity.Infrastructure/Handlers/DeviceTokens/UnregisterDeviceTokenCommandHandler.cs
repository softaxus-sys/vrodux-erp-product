using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DeviceTokens.Commands;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Handlers.DeviceTokens;

internal sealed class UnregisterDeviceTokenCommandHandler(IdentityDbContext db)
    : ICommandHandler<UnregisterDeviceTokenCommand>
{
    public async Task<Result> Handle(UnregisterDeviceTokenCommand cmd, CancellationToken ct)
    {
        // Scoped to (token, owning user) — a logout can only ever remove the device it is running
        // on, for the account it is currently signed into. A missing row is not an error: the app
        // may be unregistering a token that was never (or already) registered.
        var row = await db.UserDeviceTokens
            .FirstOrDefaultAsync(t => t.ExpoPushToken == cmd.ExpoPushToken && t.UserId == cmd.UserId, ct);
        if (row is null) return Result.Success();

        db.UserDeviceTokens.Remove(row);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
