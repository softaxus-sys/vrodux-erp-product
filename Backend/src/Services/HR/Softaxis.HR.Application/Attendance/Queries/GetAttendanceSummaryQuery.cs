using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Attendance.Dtos;

namespace Softaxis.HR.Application.Attendance.Queries;

public sealed record GetAttendanceSummaryQuery : IQuery<AttendanceSummaryDto>;
