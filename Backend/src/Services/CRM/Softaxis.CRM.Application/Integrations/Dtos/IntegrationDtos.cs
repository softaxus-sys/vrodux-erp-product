namespace Softaxis.CRM.Application.Integrations.Dtos;

/// <summary>A registered provider plus this tenant's live connection status (drives the catalog cards).</summary>
public sealed record ProviderCatalogItemDto(
    string  Key,
    string  DisplayName,
    string  Category,
    string  Description,
    IReadOnlyList<string> Capabilities,
    bool    ComingSoon,
    bool    Connected,
    Guid?   IntegrationId,
    string? Status,
    string? Health,
    DateTime? LastSyncAt);

public sealed record FieldMappingDto(Guid Id, string SourceField, string TargetField);

public sealed record IntegrationResourceDto(
    Guid Id, string ResourceType, string ExternalId, string Name, string? ParentExternalId, bool Enabled);

/// <summary>Full integration detail. Never includes decrypted credentials.</summary>
public sealed record IntegrationDto(
    Guid    Id,
    string  ProviderKey,
    string  Name,
    string  Status,
    string  Health,
    string? Config,
    string? DedupeConfig,
    string? RoutingConfig,
    string? InboundUrl,
    bool    HasCredentials,
    DateTime? LastSyncAt,
    DateTime? LastSuccessAt,
    DateTime? LastFailureAt,
    string? LastError,
    int     RetryCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyList<FieldMappingDto> FieldMappings,
    IReadOnlyList<IntegrationResourceDto> Resources);

public sealed record IntegrationSyncLogDto(
    Guid Id, string Trigger, string Status, int Fetched, int Created, int Duplicates, int Failed,
    string? Message, DateTime StartedAt, DateTime? CompletedAt);

public sealed record RawLeadInboxDto(
    Guid Id, string ProviderKey, string? ExternalId, string Status, int Attempts,
    string? LastError, Guid? CreatedLeadId, DateTime ReceivedAt, DateTime? ProcessedAt);

/// <summary>The decrypted inbound credentials — returned only to integration editors.</summary>
public sealed record IntegrationSecretDto(string? InboundUrl, string? SigningSecret);
