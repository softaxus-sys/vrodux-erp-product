using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Leaves.Dtos;

namespace Softaxis.HR.Application.Leaves.Queries;

public sealed record GetLeavesQuery(
    int     Page       = 1,
    int     PageSize   = 20,
    string? Search     = null,
    string? Status     = null,
    string? LeaveType  = null,
    Guid?   EmployeeId = null
) : IQuery<PagedResult<LeaveDto>>;
