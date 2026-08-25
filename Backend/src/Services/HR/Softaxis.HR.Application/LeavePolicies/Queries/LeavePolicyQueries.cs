using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.LeavePolicies.Dtos;

namespace Softaxis.HR.Application.LeavePolicies.Queries;

public sealed record GetLeavePoliciesQuery : IQuery<IReadOnlyList<LeavePolicyDto>>;

/// <summary>Balances for one employee. Year defaults to the current calendar year.</summary>
public sealed record GetEmployeeLeaveBalancesQuery(Guid EmployeeId, int? Year = null)
    : IQuery<IReadOnlyList<LeaveBalanceDto>>;

/// <summary>Balances for every active employee. Year defaults to the current calendar year.</summary>
public sealed record GetAllLeaveBalancesQuery(int? Year = null)
    : IQuery<IReadOnlyList<EmployeeLeaveBalancesDto>>;
