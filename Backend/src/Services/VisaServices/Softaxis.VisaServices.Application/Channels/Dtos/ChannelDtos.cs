namespace Softaxis.VisaServices.Application.Channels.Dtos;

/// <summary>A channel from the catalogue merged with the tenant's connection state.</summary>
public sealed record ChannelDto(
    string Key, string Name, string Description, bool RequiresCredentials, string Status,
    string SetupGuide, bool Connected, string? EstablishmentCard, string? AccountRef,
    bool HasSecret, DateTime? ConnectedAt);

public sealed record GovtSubmissionDto(
    Guid Id, Guid VisaCaseId, string Channel, string SubmissionType, string? ExternalReference,
    string Status, string? Notes, DateTime SubmittedAt, DateTime? UpdatedAt);
