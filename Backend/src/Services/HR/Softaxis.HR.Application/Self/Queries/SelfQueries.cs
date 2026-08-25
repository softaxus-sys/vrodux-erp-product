using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Self.Dtos;

namespace Softaxis.HR.Application.Self.Queries;

// None of these carry an employee id. The employee is resolved from the JWT, which is precisely
// what makes them structurally incapable of returning someone else's data.

public sealed record GetMyProfileQuery              : IQuery<MyProfileDto>;
public sealed record GetMyLeavesQuery               : IQuery<IReadOnlyList<LeaveDto>>;
public sealed record GetMyLeaveBalancesQuery(int? Year = null) : IQuery<IReadOnlyList<LeaveBalanceDto>>;
public sealed record GetMyAttendanceQuery(string? FromDate = null, string? ToDate = null)
    : IQuery<IReadOnlyList<AttendanceLogDto>>;
public sealed record GetMyAttendanceTodayQuery      : IQuery<MyAttendanceTodayDto>;
public sealed record GetMyPayslipsQuery             : IQuery<IReadOnlyList<EmployeePayslipDto>>;
