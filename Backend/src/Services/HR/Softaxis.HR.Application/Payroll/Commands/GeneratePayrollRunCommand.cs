using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Commands;

public sealed record GeneratePayrollRunCommand(
    string  Period,
    string? Notes,
    string? CreatedByUserId,
    string? CreatedByName
) : ICommand<PayrollRunDetailDto>;

public sealed class GeneratePayrollRunValidator : AbstractValidator<GeneratePayrollRunCommand>
{
    public GeneratePayrollRunValidator()
    {
        RuleFor(x => x.Period).NotEmpty().WithMessage("Period is required.");
    }
}
