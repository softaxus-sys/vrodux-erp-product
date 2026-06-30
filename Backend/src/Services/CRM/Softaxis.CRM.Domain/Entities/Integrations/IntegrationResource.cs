namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// A provider-side object the tenant has selected to pull leads from — e.g. a Facebook
/// Page, an Instant Form, a Google Sheet, or an Ad Account. Kept generic (type + external
/// id + name) so any provider can reuse it without schema changes.
/// </summary>
public sealed class IntegrationResource
{
    private IntegrationResource() { }

    public IntegrationResource(Guid integrationId, string resourceType, string externalId, string name, string? parentExternalId = null)
    {
        Id               = Guid.NewGuid();
        IntegrationId    = integrationId;
        ResourceType     = resourceType.Trim().ToLowerInvariant();
        ExternalId       = externalId.Trim();
        Name             = name.Trim();
        ParentExternalId = parentExternalId?.Trim();
        Enabled          = true;
    }

    public Guid    Id               { get; private set; }
    public Guid    IntegrationId    { get; private set; }
    /// <summary>"page", "form", "sheet", "ad_account", "campaign"…</summary>
    public string  ResourceType     { get; private set; } = string.Empty;
    public string  ExternalId       { get; private set; } = string.Empty;
    public string  Name             { get; private set; } = string.Empty;
    /// <summary>e.g. a form's owning page id — lets providers nest resources without extra tables.</summary>
    public string? ParentExternalId { get; private set; }
    public bool    Enabled          { get; private set; }
    /// <summary>Encrypted per-resource access token (e.g. a Facebook Page access token). Optional.</summary>
    public string? AccessToken      { get; private set; }

    public void SetEnabled(bool enabled)        => Enabled = enabled;
    public void SetAccessToken(string? encrypted) => AccessToken = encrypted;
}
