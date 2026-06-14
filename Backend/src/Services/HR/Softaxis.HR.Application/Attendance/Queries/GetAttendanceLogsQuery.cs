using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.Common.Dtos;

namespace Softaxis.HR.Application.Attendance.Queries;

public sealed record GetAttendanceLogsQuery(
    int     Page       = 1,
    int     PageSize   = 30,
    string? Date       = null,
    string? DateFrom   = null,
    string? DateTo     = null,
    string? Status     = null,
    Guid?   EmployeeId = null
) : IQuery<PagedResult<AttendanceLogDto>>;
