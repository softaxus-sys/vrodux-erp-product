using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.PublicListings.Dtos;
using Softaxis.RealEstate.Application.WebsiteIntegrations;

namespace Softaxis.RealEstate.Application.PublicListings.Queries;

/// <summary>
/// Published properties for the website that presented a valid API key. The workspace comes from
/// the key (resolved into <see cref="WebsiteClientDto"/>), never from anything the caller names.
/// </summary>
public sealed record GetPublicPropertiesQuery(
    WebsiteClientDto Client,
    string? Search = null,
    string? PropertyType = null,
    string? Emirate = null,
    string? City = null,
    int Page = 1,
    int PageSize = 24) : IQuery<PagedResult<PublicPropertyDto>>;

public sealed record GetPublicPropertyQuery(WebsiteClientDto Client, Guid Id) : IQuery<PublicPropertyDto>;

/// <summary>
/// One published property's photo, addressed by a signed, expiring URL rather than the API key —
/// browsers and image optimisers cannot attach a header to an image request, and the key must
/// never reach a browser.
/// </summary>
public sealed record GetPublicPropertyImageQuery(
    Guid IntegrationId, Guid PropertyId, Guid ImageId, long Expires, string Signature)
    : IQuery<PropertyImageFileDto>;
