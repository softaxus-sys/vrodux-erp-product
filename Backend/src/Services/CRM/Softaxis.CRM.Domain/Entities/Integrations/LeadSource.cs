namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// Provenance attached 1:1 to a <c>Lead</c> created through the integration pipeline.
/// Kept in its own table so the core <c>Lead</c> entity stays untouched (backward
/// compatible) while still capturing the full marketing-attribution chain the spec
/// requires: campaign / ad set / ad / page / form / external lead id / UTM values.
/// </summary>
public sealed class LeadSource
{
    private LeadSource() { }

    public LeadSource(Guid leadId, Guid? integrationId, string providerKey, string? externalLeadId)
    {
        Id             = Guid.NewGuid();
        LeadId         = leadId;
        IntegrationId  = integrationId;
        ProviderKey    = providerKey;
        ExternalLeadId = externalLeadId;
        ReceivedAt     = DateTime.UtcNow;
    }

    public Guid    Id             { get; private set; }
    public Guid    LeadId         { get; private set; }
    public Guid?   IntegrationId  { get; private set; }
    public string  ProviderKey    { get; private set; } = string.Empty;
    public string? ExternalLeadId { get; private set; }

    public string? Campaign       { get; private set; }
    public string? CampaignId     { get; private set; }
    public string? AdSetId        { get; private set; }
    public string? AdId           { get; private set; }
    public string? PageId         { get; private set; }
    public string? FormId         { get; private set; }

    public string? UtmSource      { get; private set; }
    public string? UtmMedium      { get; private set; }
    public string? UtmCampaign    { get; private set; }
    public string? UtmTerm        { get; private set; }
    public string? UtmContent     { get; private set; }

    /// <summary>The full normalized payload as received, for audit / replay.</summary>
    public string? RawJson        { get; private set; }
    public DateTime ReceivedAt    { get; private set; }

    public void SetAttribution(string? campaign, string? campaignId, string? adSetId, string? adId,
        string? pageId, string? formId)
    {
        Campaign = campaign; CampaignId = campaignId; AdSetId = adSetId; AdId = adId;
        PageId = pageId; FormId = formId;
    }

    public void SetUtm(string? source, string? medium, string? campaign, string? term, string? content)
    {
        UtmSource = source; UtmMedium = medium; UtmCampaign = campaign; UtmTerm = term; UtmContent = content;
    }

    public void SetRaw(string? rawJson) => RawJson = rawJson;
}
