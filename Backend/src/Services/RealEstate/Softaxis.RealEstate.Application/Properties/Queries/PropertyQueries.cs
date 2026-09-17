using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Properties.Dtos;

namespace Softaxis.RealEstate.Application.Properties.Queries;

// The portfolio only ever grows, so the list pages in SQL. Search covers the name, address and
// property number - what anyone actually looks a property up by.
public sealed record GetPropertiesQuery(
    string? Search   = null,
    string? Status   = null,
    string? PropertyType = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<PropertyDto>>;

public sealed record GetPropertyByIdQuery(Guid Id) : IQuery<PropertyDto>;

public sealed record GetPropertiesSummaryQuery : IQuery<PropertiesSummaryDto>;

/// <summary>
/// Fetches one image's raw bytes for the serving endpoint.
///
/// Scoped by property id as well as image id so a guessed image id cannot be pulled through an
/// unrelated property — the tenant filter already bounds it, but the pairing makes the intent
/// explicit and the query cheap to index.
/// </summary>
public sealed record GetPropertyImageQuery(Guid PropertyId, Guid ImageId)
    : IQuery<PropertyImageFileDto>;
