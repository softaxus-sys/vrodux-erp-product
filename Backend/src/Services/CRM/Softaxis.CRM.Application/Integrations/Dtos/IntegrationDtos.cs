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
    /// <summary>
    /// Names of the credential fields that are stored — never the values. Lets a settings screen
    /// say WHICH key is configured, rather than only that something is.
    /// </summary>
    IReadOnlyList<string> CredentialFields,
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

/// <summary>What a history backfill actually did. Skipped is not a failure — the lead was already here.</summary>
public sealed record LeadBackfillResultDto(
    int Fetched, int Created, int Duplicates, int Failed, DateTime SinceUsed, string? Note);

// ── Lead Inbox (tenant-wide inbound feed) ────────────────────────────────────

/// <summary>
/// One row of the Lead Inbox list. Carries the integration's display name so the page can say
/// "Bayut" rather than a bare guid, and the created lead's name so a delivery can be followed
/// through to what it became. No payload here — the list would ship megabytes of JSON nobody
/// is reading yet; that arrives with <see cref="LeadInboxEntryDto"/>.
/// </summary>
public sealed record LeadInboxRowDto(
    Guid Id, Guid IntegrationId, string ProviderKey, string IntegrationName,
    string? ExternalId, string Status, int Attempts, string? LastError,
    Guid? CreatedLeadId, string? CreatedLeadName,
    DateTime ReceivedAt, DateTime? ProcessedAt, DateTime? NextAttemptAt);

/// <summary>A single delivery with the raw payload exactly as it arrived.</summary>
public sealed record LeadInboxEntryDto(
    Guid Id, Guid IntegrationId, string ProviderKey, string IntegrationName,
    string? ExternalId, string Status, int Attempts, string? LastError,
    Guid? CreatedLeadId, string? CreatedLeadName,
    DateTime ReceivedAt, DateTime? ProcessedAt, DateTime? NextAttemptAt,
    string Payload);

public sealed record LeadInboxSummaryDto(
    int Total, int Pending, int Processed, int Duplicates, int Failed,
    IReadOnlyList<LeadInboxProviderCountDto> ByProvider);

public sealed record LeadInboxProviderCountDto(string ProviderKey, string Name, int Total, int Failed);

// ── Assignment backfill ──────────────────────────────────────────────────────

/// <summary>One historical lead and the owner the portal rules resolve for it.</summary>
public sealed record LeadAssignmentCandidateDto(
    Guid LeadId, string LeadName, string? Phone, DateTime CreatedAt,
    string? ListingReference, string? AgentName,
    string? CurrentOwnerName,
    Guid? ResolvedUserId, string? ResolvedUserName, Guid? ResolvedTeamId,
    /// <summary>Why nothing could be resolved — shown instead of leaving a blank row unexplained.</summary>
    string? Reason);

public sealed record LeadAssignmentBackfillPreviewDto(
    int Total, int Resolvable, int AlreadyOwned, int Unresolvable,
    IReadOnlyList<LeadAssignmentCandidateDto> Candidates);

public sealed record LeadAssignmentBackfillResultDto(int Assigned, int Skipped);
