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

// ── Queries ──────────────────────────────────────────────────────────────────

/// <summary>Null when the workspace has never connected Qasro.</summary>
public sealed record GetQasroIntegrationQuery : IQuery<QasroIntegrationDto?>;

public sealed record GetQasroPublishedPropertiesQuery : IQuery<IReadOnlyList<QasroPublishedPropertyDto>>;

// ── Commands ─────────────────────────────────────────────────────────────────

/// <summary>One-click activate — no form, no manual key entry. See ConnectQasroHandler for the
/// service-to-service flow this triggers.</summary>
public sealed record ConnectQasroCommand : ICommand<QasroIntegrationDto>;

public sealed record DisconnectQasroCommand : ICommand;

/// <summary>Takes every property off Qasro at once (used on disconnect, and offered standalone).
/// Returns how many were withdrawn.</summary>
public sealed record WithdrawAllQasroListingsCommand : ICommand<int>;
