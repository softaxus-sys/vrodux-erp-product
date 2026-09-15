using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Identity.Application.DeviceTokens.Commands;

/// <summary>Registers (or re-registers) the current user's Expo push token — called once at app
/// start / login and again whenever Expo reissues the token.</summary>
public sealed record RegisterDeviceTokenCommand(
    Guid UserId, string ExpoPushToken, string Platform, string? DeviceName) : ICommand;
