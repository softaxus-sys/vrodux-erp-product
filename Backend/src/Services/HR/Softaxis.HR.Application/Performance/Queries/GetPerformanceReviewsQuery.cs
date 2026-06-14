using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Performance.Dtos;

namespace Softaxis.HR.Application.Performance.Queries;

public sealed record GetPerformanceReviewsQuery(
    int     Page       = 1,
    int     PageSize   = 20,
    string? Status     = null,
    Guid?   EmployeeId = null
) : IQuery<PagedResult<ReviewDto>>;
