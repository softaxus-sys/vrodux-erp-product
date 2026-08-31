using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Contracts.Dtos;

namespace Softaxis.RealEstate.Application.Contracts.Commands;

public sealed record CreateContractCommand(
    Guid PropertyId, Guid UnitId, Guid TenantId,
    string StartDate, string EndDate, decimal AnnualRent, decimal SecurityDeposit,
    string PaymentFrequency, string? EjariNumber, string? Notes,
    // Rent handed over at signing. Applied across the schedule from the first installment onward,
    // so a tenant who has already paid is not chased for it on day one.
    decimal AdvanceRentAmount = 0,
    string? AdvancePaidDate = null, string? AdvanceMethod = null, string? AdvanceReference = null)
    : ICommand<CreatedContractDto>;

public sealed class CreateContractValidator : AbstractValidator<CreateContractCommand>
{
    public CreateContractValidator()
    {
        RuleFor(x => x.PropertyId).NotEmpty();
        RuleFor(x => x.UnitId).NotEmpty();
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty().Must(BeADate).WithMessage("Start date must be yyyy-MM-dd.");
        RuleFor(x => x.EndDate).NotEmpty().Must(BeADate).WithMessage("End date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.EndDate, x.StartDate) > 0)
            .WithMessage("End date must be after the start date.");
        RuleFor(x => x.AnnualRent).GreaterThan(0);
        RuleFor(x => x.SecurityDeposit).GreaterThanOrEqualTo(0);
        RuleFor(x => x.PaymentFrequency)
            .Must(f => f is "monthly" or "quarterly" or "semi_annual" or "annual")
            .WithMessage("Payment frequency must be monthly, quarterly, semi_annual or annual.");
        RuleFor(x => x.AdvanceRentAmount).GreaterThanOrEqualTo(0)
            .WithMessage("Advance rent cannot be negative.");
        // Only the format is checked here; whether it is sane relative to the term is the handler's
        // job, which is the only place that knows the generated schedule.
        RuleFor(x => x.AdvancePaidDate).Must(d => d is null || BeADate(d))
            .WithMessage("Advance payment date must be yyyy-MM-dd.");
    }

    internal static bool BeADate(string s) =>
        DateTime.TryParseExact(s, "yyyy-MM-dd", null, System.Globalization.DateTimeStyles.None, out _);
}

// RegenerateSchedule rebuilds the installments from the new dates/rent. The handler refuses once
// any payment has been recorded — regenerating would discard money already taken.
public sealed record UpdateContractCommand(
    Guid Id, string StartDate, string EndDate, decimal AnnualRent, decimal SecurityDeposit,
    string PaymentFrequency, string? EjariNumber, string? Notes,
    bool RegenerateSchedule = false) : ICommand;

public sealed class UpdateContractValidator : AbstractValidator<UpdateContractCommand>
{
    public UpdateContractValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty().Must(CreateContractValidator.BeADate);
        RuleFor(x => x.EndDate).NotEmpty().Must(CreateContractValidator.BeADate);
        RuleFor(x => x.AnnualRent).GreaterThan(0);
    }
}

public sealed record DeleteContractCommand(Guid Id) : ICommand;

public sealed record SetContractStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetContractStatusValidator : AbstractValidator<SetContractStatusCommand>
{
    public SetContractStatusValidator() =>
        RuleFor(x => x.Status).Must(s => s is "active" or "expired" or "terminated" or "renewed")
            .WithMessage("Status must be active, expired, terminated or renewed.");
}

public sealed record GenerateRentScheduleCommand(Guid ContractId, bool ReplaceExisting = false)
    : ICommand<IReadOnlyList<RentInstallmentDto>>;

public sealed record RecordInstallmentPaymentCommand(
    Guid ContractId, Guid InstallmentId, decimal Amount, string PaidDate,
    string? Method, string? Reference, string? Notes) : ICommand<RentInstallmentDto>;

public sealed class RecordInstallmentPaymentValidator : AbstractValidator<RecordInstallmentPaymentCommand>
{
    public RecordInstallmentPaymentValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.PaidDate).NotEmpty().Must(CreateContractValidator.BeADate);
    }
}

public sealed record WaiveInstallmentCommand(Guid ContractId, Guid InstallmentId, string? Reason) : ICommand;

/// <summary>Manually send the reminder for one installment or contract, outside the daily sweep.</summary>
public sealed record SendRentReminderCommand(Guid ContractId, Guid? InstallmentId) : ICommand<string>;
