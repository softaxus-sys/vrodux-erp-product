using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;

namespace Softaxis.Hospitality.Application.Housekeeping.Queries;

public sealed record GetHousekeepingSummaryQuery : IQuery<HousekeepingSummaryDto>;

// One or more rows per room per day, kept forever. Pages in SQL.
public sealed record GetHousekeepingTasksQuery(
    string? Status   = null,
    string? TaskType = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<HousekeepingTaskDto>>;
