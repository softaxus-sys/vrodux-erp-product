using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Attendance.Dtos;

namespace Softaxis.HR.Application.Attendance.Commands;

public sealed record CreateAttendanceLogCommand(
    Guid     EmployeeId,
    string   EmployeeName,
    string   Date,
    string?  CheckIn,
    string?  CheckOut,
    decimal? WorkingHours,
    string   Status,
    string?  Notes
) : ICommand<AttendanceLogDto>;

public sealed class CreateAttendanceLogValidator : AbstractValidator<CreateAttendanceLogCommand>
{
    public CreateAttendanceLogValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty().WithMessage("Employee is required.");
        RuleFor(x => x.EmployeeName).NotEmpty().WithMessage("Employee name is required.");
        RuleFor(x => x.Date).NotEmpty().WithMessage("Date is required.");
        RuleFor(x => x.Status).NotEmpty().WithMessage("Status is required.");
    }
}
