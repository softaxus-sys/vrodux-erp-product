using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Leaves.Dtos;

namespace Softaxis.HR.Application.Leaves.Commands;

public sealed record CreateLeaveCommand(
    Guid    EmployeeId,
    string  EmployeeName,
    string  LeaveType,
    string  StartDate,
    string  EndDate,
    decimal TotalDays,
    string? Reason
) : ICommand<LeaveDto>;

public sealed class CreateLeaveValidator : AbstractValidator<CreateLeaveCommand>
{
    public CreateLeaveValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty().WithMessage("Employee is required.");
        RuleFor(x => x.EmployeeName).NotEmpty().WithMessage("Employee name is required.");
        RuleFor(x => x.LeaveType).NotEmpty().WithMessage("Leave type is required.");
        RuleFor(x => x.StartDate).NotEmpty().WithMessage("Start date is required.");
        RuleFor(x => x.EndDate).NotEmpty().WithMessage("End date is required.");
    }
}
