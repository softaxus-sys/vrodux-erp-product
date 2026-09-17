using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.PublicListings.Dtos;

namespace Softaxis.RealEstate.Application.PublicListings.Queries;

/// <summary>
/// Published properties for one tenant's website. Anonymous: the tenant comes from the URL slug,
/// never from a token.
/// </summary>
public sealed record GetPublicPropertiesQuery(
    string TenantSlug,
    string? Search = null,
    string? PropertyType = null,
    string? Emirate = null,
    string? City = null,
    int Page = 1,
    int PageSize = 24) : IQuery<PagedResult<PublicPropertyDto>>;

public sealed record GetPublicPropertyQuery(string TenantSlug, Guid Id) : IQuery<PublicPropertyDto>;

public sealed record GetPublicCompanyQuery(string TenantSlug) : IQuery<PublicCompanyDto>;

/// <summary>
/// One published property's photo.
///
/// Carries the slug and the property id as well as the image id so the handler can prove the
/// image belongs to a property that is actually published by that tenant. Serving by image id
/// alone would let anyone who guesses a GUID pull photographs out of unpublished properties —
/// and out of other tenants entirely.
/// </summary>
public sealed record GetPublicPropertyImageQuery(string TenantSlug, Guid PropertyId, Guid ImageId)
    : IQuery<PropertyImageFileDto>;
