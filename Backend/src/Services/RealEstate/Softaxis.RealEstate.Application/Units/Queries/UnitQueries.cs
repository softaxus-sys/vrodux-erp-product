using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Units.Dtos;

namespace Softaxis.RealEstate.Application.Units.Queries;

// A portfolio of 500 properties holds thousands of units, so the list pages in SQL.
public sealed record GetUnitsQuery(
    Guid?   PropertyId = null,
    string? Search     = null,
    string? Status     = null,
    int     Page       = 1,
    int     PageSize   = 30) : IQuery<PagedResult<UnitDto>>;

public sealed record GetUnitsSummaryQuery : IQuery<UnitsSummaryDto>;
