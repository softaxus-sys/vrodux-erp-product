using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Integrations.Dtos;

namespace Softaxis.CRM.Application.Integrations.Queries;

/// <summary>Provider catalog merged with this tenant's connection state.</summary>
public sealed record GetProviderCatalogQuery() : IQuery<IReadOnlyList<ProviderCatalogItemDto>>;

public sealed record GetIntegrationsQuery() : IQuery<IReadOnlyList<IntegrationDto>>;

public sealed record GetIntegrationByIdQuery(Guid Id) : IQuery<IntegrationDto>;

public sealed record GetIntegrationSyncLogsQuery(Guid IntegrationId)
    : IQuery<IReadOnlyList<IntegrationSyncLogDto>>;

/// <summary>Per-integration inbound history / error log (optionally filtered by status).</summary>
public sealed record GetIntegrationInboxQuery(Guid IntegrationId, string? Status)
    : IQuery<IReadOnlyList<RawLeadInboxDto>>;

/// <summary>Reveal the inbound URL + decrypted signing secret (editors only).</summary>
public sealed record GetIntegrationSecretQuery(Guid Id) : IQuery<IntegrationSecretDto>;
