using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

internal static class IntegrationMappings
{
    public static IntegrationDto ToDto(Integration i, string? inboundBaseUrl) => new(
        i.Id, i.ProviderKey, i.Name, i.Status, i.Health, i.Config, i.DedupeConfig, i.RoutingConfig,
        BuildInboundUrl(inboundBaseUrl, i.InboundKey),
        HasCredentials: i.Credentials is not null,
        i.LastSyncAt, i.LastSuccessAt, i.LastFailureAt, i.LastError, i.RetryCount, i.CreatedAt, i.UpdatedAt,
        i.FieldMappings.Select(m => new FieldMappingDto(m.Id, m.SourceField, m.TargetField)).ToList(),
        i.Resources.Select(r => new IntegrationResourceDto(
            r.Id, r.ResourceType, r.ExternalId, r.Name, r.ParentExternalId, r.Enabled)).ToList());

    public static IntegrationSyncLogDto ToDto(IntegrationSyncLog l) => new(
        l.Id, l.Trigger, l.Status, l.Fetched, l.Created, l.Duplicates, l.Failed, l.Message, l.StartedAt, l.CompletedAt);

    public static RawLeadInboxDto ToDto(RawLeadInbox r) => new(
        r.Id, r.ProviderKey, r.ExternalId, r.Status, r.Attempts, r.LastError, r.CreatedLeadId, r.ReceivedAt, r.ProcessedAt);

    /// <summary>Inbound webhook/custom-API URL for this integration. Relative when no public base URL is configured.</summary>
    public static string BuildInboundUrl(string? baseUrl, string inboundKey)
    {
        var path = $"/api/webhooks/{inboundKey}";
        return string.IsNullOrWhiteSpace(baseUrl) ? path : $"{baseUrl.TrimEnd('/')}{path}";
    }
}
