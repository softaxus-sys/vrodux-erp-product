using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Listings.Dtos;

namespace Softaxis.RealEstate.Application.Listings.Queries;

public sealed record GetListingsQuery(
    string? Search = null,
    /// <summary>rent / sale. Null means both.</summary>
    string? Purpose = null,
    string? Status = null,
    string? PropertyType = null,
    string? Category = null,
    Guid? PropertyId = null,
    /// <summary>True for units advertised on a portal, false for those that are not, null for all.</summary>
    bool? Advertised = null,
    int Page = 1,
    int PageSize = 30) : IQuery<PagedResult<ListingDto>>;

public sealed record GetListingByIdQuery(Guid Id) : IQuery<ListingDto>;

public sealed record GetListingsSummaryQuery : IQuery<ListingsSummaryDto>;

/// <summary>
/// The property types this workspace uses, for the creatable picker on the listing form.
/// </summary>
/// <remarks>
/// No table behind it: the type is stored on the property, so the list is the built-in defaults
/// plus every type already in use — the same approach as job designations in HR. A new type is
/// created simply by being typed once, and it is offered from then on.
/// </remarks>
public sealed record GetPropertyTypesQuery : IQuery<IReadOnlyList<string>>;
