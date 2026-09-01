using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.LeavePolicies.Dtos;

namespace Softaxis.HR.Application.LeavePolicies.Queries;

public sealed record GetLeavePoliciesQuery : IQuery<IReadOnlyList<LeavePolicyDto>>;

/// <summary>Balances for one employee. Year defaults to the current calendar year.</summary>
public sealed record GetEmployeeLeaveBalancesQuery(Guid EmployeeId, int? Year = null)
    : IQuery<IReadOnlyList<LeaveBalanceDto>>;

/// <summary>
/// Balances for every active employee. Year defaults to the current calendar year.
/// Pages in SQL — this grows with headcount, and the leave aggregate underneath it grows with
/// headcount × requests, so the unbounded form gets slower every time someone is hired.
/// </summary>
public sealed record GetAllLeaveBalancesQuery(
    int?    Year     = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 25) : IQuery<PagedResult<EmployeeLeaveBalancesDto>>;
