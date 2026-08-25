using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Self.Dtos;

namespace Softaxis.HR.Application.Self.Commands;

public sealed record ApplyForLeaveCommand(
    string  LeaveType,
    string  StartDate,
    string  EndDate,
    decimal TotalDays,
    string? Reason) : ICommand<LeaveDto>;

/// <summary>Cancels one of my own requests. The handler proves the leave belongs to me.</summary>
public sealed record CancelMyLeaveCommand(Guid LeaveId) : ICommand;

/// <summary>
/// Records a check-in for today. No geolocation or IP is captured — that is a privacy decision
/// for the tenant, not a default.
/// </summary>
public sealed record CheckInCommand  : ICommand<MyAttendanceTodayDto>;
public sealed record CheckOutCommand : ICommand<MyAttendanceTodayDto>;

public sealed class ApplyForLeaveValidator : AbstractValidator<ApplyForLeaveCommand>
{
    public ApplyForLeaveValidator()
    {
        RuleFor(x => x.LeaveType).NotEmpty().WithMessage("Leave type is required.");
        RuleFor(x => x.StartDate).NotEmpty().WithMessage("Start date is required.");
        RuleFor(x => x.EndDate).NotEmpty().WithMessage("End date is required.");
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("End date cannot be before the start date.");
        RuleFor(x => x.TotalDays).GreaterThan(0).WithMessage("A request must cover at least part of a day.");
    }
}
