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
