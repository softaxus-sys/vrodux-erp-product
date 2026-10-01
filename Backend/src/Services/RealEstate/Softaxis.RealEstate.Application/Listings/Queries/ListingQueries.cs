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
    int PageSize = 30,
    // ── The multi-select filter bar ──
    // Each list is "any of these"; the lists combine with AND. Null or empty means no filter.
    IReadOnlyList<Guid>? PropertyIds = null,
    /// <summary>Bedroom counts. A studio is 0, matching what the importer stores.</summary>
    IReadOnlyList<int>? Bedrooms = null,
    IReadOnlyList<string>? PropertyTypes = null,
    IReadOnlyList<string>? Statuses = null,
    IReadOnlyList<string>? Furnishings = null,
    IReadOnlyList<string>? Cities = null,
    IReadOnlyList<string>? Agents = null,
    /// <summary>Compared against the asking price for a sale listing and the annual rent otherwise.</summary>
    decimal? MinPrice = null,
    decimal? MaxPrice = null) : IQuery<PagedResult<ListingDto>>;

/// <summary>
/// What the filter bar can offer: only values that some listing actually has, so no option ever
/// leads to an empty table.
/// </summary>
public sealed record GetListingFilterOptionsQuery : IQuery<ListingFilterOptionsDto>;

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
