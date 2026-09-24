namespace Softaxis.Seo.Application.Google.Dtos;

public sealed record GoogleOAuthUrlDto(string Url);
public sealed record GoogleCallbackResultDto(Guid SiteId);
/// <summary>"gsc_property" | "ga4_property" — see Domain.Entities.SeoGoogleResourceTypes.</summary>
public sealed record GooglePropertyDto(string ExternalId, string Name, string ResourceType);
public sealed record GooglePropertiesResultDto(
    IReadOnlyList<GooglePropertyDto> GscProperties,
    IReadOnlyList<GooglePropertyDto> Ga4Properties);
public sealed record SelectGooglePropertiesRequest(
    string? GscPropertyId, string? GscPropertyName, string? Ga4PropertyId, string? Ga4PropertyName);
