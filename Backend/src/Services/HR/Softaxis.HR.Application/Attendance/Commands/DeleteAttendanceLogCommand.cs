using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Attendance.Commands;

public sealed record DeleteAttendanceLogCommand(Guid Id) : ICommand;
