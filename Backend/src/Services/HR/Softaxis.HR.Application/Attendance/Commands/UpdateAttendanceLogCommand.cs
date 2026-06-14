using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Attendance.Commands;

public sealed record UpdateAttendanceLogCommand(
    Guid     Id,
    string?  CheckIn,
    string?  CheckOut,
    decimal? WorkingHours,
    string   Status,
    string?  Notes
) : ICommand;

public sealed class UpdateAttendanceLogValidator : AbstractValidator<UpdateAttendanceLogCommand>
{
    public UpdateAttendanceLogValidator()
    {
        RuleFor(x => x.Status).NotEmpty().WithMessage("Status is required.");
    }
}
