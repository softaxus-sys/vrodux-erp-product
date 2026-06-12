using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.FiscalPeriods.Dtos;

namespace Softaxis.Finance.Application.FiscalPeriods.Commands;

/// <summary>Closes an accounting period ("yyyy-MM"), creating it first if it doesn't exist yet.</summary>
public sealed record ClosePeriodCommand(string PeriodCode, string? ClosedByName) : ICommand<FiscalPeriodDto>;

public sealed class ClosePeriodValidator : AbstractValidator<ClosePeriodCommand>
{
    public ClosePeriodValidator()
    {
        RuleFor(x => x.PeriodCode)
            .NotEmpty().WithMessage("Period code is required.")
            .Matches(@"^\d{4}-\d{2}$").WithMessage("Period code must be in 'yyyy-MM' format.");
    }
}

/// <summary>Reopens a previously closed accounting period.</summary>
public sealed record ReopenPeriodCommand(string PeriodCode) : ICommand<FiscalPeriodDto>;

public sealed class ReopenPeriodValidator : AbstractValidator<ReopenPeriodCommand>
{
    public ReopenPeriodValidator()
    {
        RuleFor(x => x.PeriodCode)
            .NotEmpty().WithMessage("Period code is required.")
            .Matches(@"^\d{4}-\d{2}$").WithMessage("Period code must be in 'yyyy-MM' format.");
    }
}
