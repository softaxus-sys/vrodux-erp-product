namespace Softaxis.Seo.Domain.Entities;

/// <summary>A selected Google property — a Search Console site or a GA4 property. Mirrors CRM's
/// generic <c>IntegrationResource</c> shape (type + external id + name, no per-provider schema).</summary>
public sealed class SeoGoogleResource
{
    private SeoGoogleResource() { }

    public SeoGoogleResource(Guid integrationId, string resourceType, string externalId, string name)
    {
        Id            = Guid.NewGuid();
        IntegrationId = integrationId;
        ResourceType  = resourceType.Trim().ToLowerInvariant();
        ExternalId    = externalId.Trim();
        Name          = name.Trim();
    }

    public Guid   Id            { get; private set; }
    public Guid   IntegrationId { get; private set; }
    /// <summary>"gsc_property" | "ga4_property" — see <see cref="SeoGoogleResourceTypes"/>.</summary>
    public string ResourceType  { get; private set; } = string.Empty;
    public string ExternalId    { get; private set; } = string.Empty;
    public string Name          { get; private set; } = string.Empty;
}

public static class SeoGoogleResourceTypes
{
    public const string GscProperty = "gsc_property";
    public const string Ga4Property = "ga4_property";
}
