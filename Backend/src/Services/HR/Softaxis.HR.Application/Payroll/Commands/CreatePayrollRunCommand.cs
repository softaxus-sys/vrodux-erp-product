using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record CreatePayrollRunCommand(
    string  Period,
    string? Notes,
    IReadOnlyList<PayrollSlipInputDto> Slips,
    string? CreatedByUserId,
    string? CreatedByName
) : ICommand<PayrollRunDetailDto>;

public sealed class CreatePayrollRunValidator : AbstractValidator<CreatePayrollRunCommand>
{
    public CreatePayrollRunValidator()
    {
        RuleFor(x => x.Period).NotEmpty().WithMessage("Period is required.");
        RuleFor(x => x.Slips).NotEmpty().WithMessage("At least one payroll slip is required.");
    }
}
