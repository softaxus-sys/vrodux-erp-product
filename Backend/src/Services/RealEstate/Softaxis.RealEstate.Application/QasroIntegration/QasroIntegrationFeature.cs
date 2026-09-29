using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.RealEstate.Application.QasroIntegrations;

// ── DTOs ─────────────────────────────────────────────────────────────────────

/// <summary>The connection as an administrator sees it. Never carries the key — there is nowhere
/// for a tenant to paste it, unlike the "own website" integration.</summary>
public sealed record QasroIntegrationDto(
    Guid Id,
    string? QasroAgencyId,
    string Status, // connecting | connected | error | disconnected
    string? LastError,
    DateTime CreatedAt,
    DateTime? ConnectedAt,
    DateTime? LastUsedAt,
    int PublishedPropertyCount);

public sealed record QasroPublishedPropertyDto(
    Guid Id, string PropertyNumber, string Name, string City, DateTime? PublishedAt, int ImageCount);

public sealed record QasroOAuthUrlDto(string Url);

// ── Queries ──────────────────────────────────────────────────────────────────

/// <summary>Null when the workspace has never connected Qasro.</summary>
public sealed record GetQasroIntegrationQuery : IQuery<QasroIntegrationDto?>;

public sealed record GetQasroPublishedPropertiesQuery : IQuery<IReadOnlyList<QasroPublishedPropertyDto>>;

// ── Commands ─────────────────────────────────────────────────────────────────

/// <summary>Starts the real OAuth handshake — the tenant admin is redirected to Qasro to log in or
/// sign up, and Qasro gates the connection on the agency being approved/active. See
/// StartQasroOAuthHandler and IQasroClient's own remarks for why this replaced a one-click,
/// no-login "activate" flow.</summary>
public sealed record StartQasroOAuthCommand(string RedirectUri) : ICommand<QasroOAuthUrlDto>;

/// <summary>Runs anonymously — Qasro redirects the tenant admin's browser back here with no JWT.
/// The tenant is resolved from the signed OAuth state, exactly like the Meta and Google OAuth
/// callbacks elsewhere in this codebase.</summary>
public sealed record QasroOAuthCallbackCommand(string Code, string State, string RedirectUri) : ICommand;

public sealed record DisconnectQasroCommand : ICommand;

/// <summary>Takes every property off Qasro at once (used on disconnect, and offered standalone).
/// Returns how many were withdrawn.</summary>
public sealed record WithdrawAllQasroListingsCommand : ICommand<int>;
