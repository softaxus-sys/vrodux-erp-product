namespace Softaxis.HR.Application.Leaves.Dtos;

public sealed record LeaveDto(
    Guid      Id,
    string    LeaveNumber,
    Guid      EmployeeId,
    string    EmployeeName,
    string    LeaveType,
    string    StartDate,
    string    EndDate,
    decimal   TotalDays,
    string?   Reason,
    string    Status,
    Guid?     ApprovedById,
    string?   ApproverNotes,
    DateTime? ApprovedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record LeaveTypeCountDto(string LeaveType, int Count);

public sealed record LeavesSummaryDto(
    int PendingApprovals,
    int Approved,
    int Rejected,
    IReadOnlyList<LeaveTypeCountDto> ThisMonthByType,
    int Pending,
    int OnLeaveToday);
