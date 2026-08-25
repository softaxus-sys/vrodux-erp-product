namespace Softaxis.HR.Application.LeavePolicies.Dtos;

public sealed record LeavePolicyDto(
    Guid    Id,
    string  LeaveType,
    decimal AnnualEntitlementDays,
    bool    IsPaid,
    string? Description,
    bool    IsActive);

/// <summary>
/// One leave type's position for an employee in a given year. Every figure is derived —
/// entitlement from the tenant's policy, used/pending from the employee's own requests.
/// </summary>
public sealed record LeaveBalanceDto(
    string  LeaveType,
    decimal EntitlementDays,
    decimal UsedDays,
    decimal PendingDays,
    decimal RemainingDays,
    bool    IsPaid,
    int     Year);

/// <summary>One employee's balances across every active policy — the Balances tab.</summary>
public sealed record EmployeeLeaveBalancesDto(
    Guid    EmployeeId,
    string  EmployeeName,
    string? Department,
    IReadOnlyList<LeaveBalanceDto> Balances);
