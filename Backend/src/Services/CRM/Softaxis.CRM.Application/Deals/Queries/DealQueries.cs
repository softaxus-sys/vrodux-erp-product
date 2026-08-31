using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Deals.Dtos;

namespace Softaxis.CRM.Application.Deals.Queries;

/// <summary>Every opportunity on one account. Bounded by the account, so it does not page —
/// the pipeline screen uses <see cref="GetDealsPagedQuery"/>.</summary>
public sealed record GetDealsQuery(Guid? CustomerId = null) : IQuery<IReadOnlyList<DealDto>>;

/// <summary>The pipeline screen. Filtering, searching and paging run in SQL.</summary>
public sealed record GetDealsPagedQuery(
    int     Page       = 1,
    int     PageSize   = 30,
    string? Search     = null,
    string? Stage      = null,
    Guid?   CustomerId = null) : IQuery<PagedResult<DealDto>>;

public sealed record GetDealByIdQuery(Guid Id) : IQuery<DealDto>;

public sealed record GetDealsSummaryQuery : IQuery<DealsSummaryDto>;
