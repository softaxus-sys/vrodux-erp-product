using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Trade.Domain.Entities;

namespace Softaxis.Trade.Application.Duty;

public sealed record DutyRateDto(Guid Id, string HsCode, string? Description, decimal DutyPercent, string? Notes);

public sealed record DutyRateInput(string HsCode, string? Description, decimal DutyPercent, string? Notes);

public sealed record GetDutyRatesQuery(string? Search = null) : IQuery<IReadOnlyList<DutyRateDto>>;
public sealed record CreateDutyRateCommand(DutyRateInput Rate) : ICommand<DutyRateDto>;
public sealed record UpdateDutyRateCommand(Guid Id, DutyRateInput Rate) : ICommand<DutyRateDto>;
public sealed record DeleteDutyRateCommand(Guid Id) : ICommand;

public sealed class DutyRateInputValidator : AbstractValidator<DutyRateInput>
{
    public DutyRateInputValidator()
    {
        RuleFor(x => x.HsCode).NotEmpty().WithMessage("HS code is required.").MaximumLength(20)
            .Must(c => HsDutyRate.Digits(c).Length is >= 2 and <= 12).WithMessage("An HS code has between 2 and 12 digits.");
        RuleFor(x => x.DutyPercent).InclusiveBetween(0, 500).WithMessage("The duty rate must be between 0 and 500 percent.");
        RuleFor(x => x.Description).MaximumLength(300);
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public sealed class CreateDutyRateValidator : AbstractValidator<CreateDutyRateCommand>
{
    public CreateDutyRateValidator() => RuleFor(x => x.Rate).SetValidator(new DutyRateInputValidator());
}

public sealed class UpdateDutyRateValidator : AbstractValidator<UpdateDutyRateCommand>
{
    public UpdateDutyRateValidator() => RuleFor(x => x.Rate).SetValidator(new DutyRateInputValidator());
}

// ── Estimate for one shipment ───────────────────────────────────────────────

/// <param name="Rate">Null when no rate covers this line's HS code (or it has none).</param>
public sealed record DutyLineDto(
    Guid ItemId, string Description, string? HsCode, decimal CustomsValue, string? MatchedCode, decimal? Rate, decimal Duty);

public sealed record DutyEstimateDto(
    IReadOnlyList<DutyLineDto> Lines, decimal TotalDuty, decimal CustomsValue, int Unmatched, bool IncludesFreightAndInsurance);

/// <param name="IncludeFreightInsurance">
/// Customs value on a CIF basis: the goods plus the freight and insurance entered on the shipment,
/// shared across lines by value. Off, duty is charged on the goods alone (an FOB basis).
/// </param>
public sealed record GetDutyEstimateQuery(Guid ShipmentId, bool IncludeFreightInsurance) : IQuery<DutyEstimateDto>;
