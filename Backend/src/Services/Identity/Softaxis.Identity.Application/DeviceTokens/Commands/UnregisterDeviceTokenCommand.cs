using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.DeviceTokens.Commands;

/// <summary>Removes one device's token — called best-effort on logout, so a signed-out phone stops
/// receiving pushes for the account it just left. Scoped to the calling user's own token: nobody
/// can unregister a device they don't own.</summary>
public sealed record UnregisterDeviceTokenCommand(Guid UserId, string ExpoPushToken) : ICommand;
