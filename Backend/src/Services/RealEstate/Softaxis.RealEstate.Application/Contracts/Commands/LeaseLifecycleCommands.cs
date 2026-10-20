using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Contracts.Dtos;

namespace Softaxis.RealEstate.Application.Contracts.Commands;

// ── Renewal ──────────────────────────────────────────────────────────────────

/// <summary>
/// Renews a lease: creates the lease that follows it for the same unit and tenant, and marks the
/// current one renewed. The current lease's schedule and payments are left exactly as they are.
/// </summary>
public sealed record RenewContractCommand(
    Guid Id, string StartDate, string EndDate, decimal AnnualRent, decimal SecurityDeposit,
    string PaymentFrequency, string? EjariNumber, string? Notes,
    decimal AdvanceRentAmount = 0,
    string? AdvancePaidDate = null, string? AdvanceMethod = null, string? AdvanceReference = null)
    : ICommand<RenewedContractDto>;

public sealed class RenewContractValidator : AbstractValidator<RenewContractCommand>
{
    public RenewContractValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty().Must(CreateContractValidator.BeADate)
            .WithMessage("Start date must be yyyy-MM-dd.");
        RuleFor(x => x.EndDate).NotEmpty().Must(CreateContractValidator.BeADate)
            .WithMessage("End date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.EndDate, x.StartDate) > 0)
            .WithMessage("End date must be after the start date.");
        RuleFor(x => x.AnnualRent).GreaterThan(0).WithMessage("Annual rent must be more than zero.");
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PaymentFrequency)
            .Must(f => f is "monthly" or "quarterly" or "semi_annual" or "annual")
            .WithMessage("Payment frequency must be monthly, quarterly, semi_annual or annual.");
        RuleFor(x => x.AdvanceRentAmount).GreaterThanOrEqualTo(0)
            .WithMessage("Advance rent cannot be negative.");
        RuleFor(x => x.AdvancePaidDate).Must(d => d is null || CreateContractValidator.BeADate(d))
            .WithMessage("Advance payment date must be yyyy-MM-dd.");
    }
}

// ── Termination ──────────────────────────────────────────────────────────────

/// <summary>
/// Ends a lease early. A termination date of today or earlier takes effect at once; a later date
/// is recorded as notice, and the lease ends by itself on that day.
/// </summary>
public sealed record TerminateContractCommand(
    Guid Id, string TerminationDate, string? NoticeDate, string Reason, string? ReasonNotes,
    decimal PenaltyAmount = 0, decimal DeductionsAmount = 0, string? DeductionNotes = null)
    : ICommand<LeaseTerminationDto>;

public sealed class TerminateContractValidator : AbstractValidator<TerminateContractCommand>
{
    public TerminateContractValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.TerminationDate).NotEmpty().Must(CreateContractValidator.BeADate)
            .WithMessage("Termination date must be yyyy-MM-dd.");
        RuleFor(x => x.NoticeDate).Must(d => string.IsNullOrEmpty(d) || CreateContractValidator.BeADate(d))
            .WithMessage("Notice date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.IsNullOrEmpty(x.NoticeDate)
                || string.CompareOrdinal(x.NoticeDate, x.TerminationDate) <= 0)
            .WithMessage("Notice date cannot be after the termination date.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Choose a reason for ending the lease.");
        RuleFor(x => x.PenaltyAmount).GreaterThanOrEqualTo(0).WithMessage("Penalty cannot be negative.");
        RuleFor(x => x.DeductionsAmount).GreaterThanOrEqualTo(0).WithMessage("Deductions cannot be negative.");
        RuleFor(x => x.ReasonNotes).MaximumLength(1000);
        RuleFor(x => x.DeductionNotes).MaximumLength(1000);
    }
}

/// <summary>Withdraws a notice that has not taken effect yet. The lease carries on as before.</summary>
public sealed record WithdrawTerminationCommand(Guid Id) : ICommand;

/// <summary>Records that the final account was paid — the refund to the tenant, or the balance
/// collected from them.</summary>
public sealed record SettleTerminationCommand(
    Guid Id, string SettledOn, string? Method, string? Reference, string? Notes)
    : ICommand<LeaseTerminationDto>;

public sealed class SettleTerminationValidator : AbstractValidator<SettleTerminationCommand>
{
    public SettleTerminationValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.SettledOn).NotEmpty().Must(CreateContractValidator.BeADate)
            .WithMessage("Settlement date must be yyyy-MM-dd.");
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}
