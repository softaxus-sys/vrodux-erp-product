using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Calendar.Application.Events.Dtos;

namespace Softaxis.Calendar.Application.Google;

public sealed record ConnectionDto(
    bool Configured,        // the server has Google client id/secret
    string Status,          // disconnected | connected | error
    string? AccountEmail,
    DateTime? LastSyncAt,
    string? LastError);

public sealed record OAuthUrlDto(string Url);
public sealed record OAuthResultDto(Guid UserId);

public sealed record GetConnectionQuery : IQuery<ConnectionDto>;
public sealed record StartGoogleConnectCommand(string RedirectUri) : ICommand<OAuthUrlDto>;
public sealed record GoogleCallbackCommand(string Code, string State, string RedirectUri) : ICommand<OAuthResultDto>;
public sealed record DisconnectGoogleCommand : ICommand;
/// <summary>Pull whatever changed on Google since the last sync, and push anything not yet there.</summary>
public sealed record SyncNowCommand : ICommand<SyncResultDto>;
