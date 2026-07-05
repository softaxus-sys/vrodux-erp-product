using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.ExchangeRates.Dtos;

namespace Softaxis.Finance.Application.ExchangeRates.Commands;

/// <summary>Sets the daily exchange rate (units of base currency per 1 unit of CurrencyCode).</summary>
public sealed record CreateExchangeRateCommand(
    string  CurrencyCode,
    string  RateDate,
    decimal Rate
) : ICommand<ExchangeRateDto>;

public sealed class CreateExchangeRateValidator : AbstractValidator<CreateExchangeRateCommand>
{
    public CreateExchangeRateValidator()
    {
        RuleFor(x => x.CurrencyCode)
            .NotEmpty().WithMessage("Currency code is required.")
            .Length(3).WithMessage("Currency code must be 3 characters.");

        RuleFor(x => x.RateDate)
            .NotEmpty().WithMessage("Rate date is required.");

        RuleFor(x => x.Rate)
            .GreaterThan(0).WithMessage("Rate must be greater than zero.");
    }
}

public sealed record UpdateExchangeRateCommand(
    Guid    Id,
    decimal Rate
) : ICommand<ExchangeRateDto>;

public sealed class UpdateExchangeRateValidator : AbstractValidator<UpdateExchangeRateCommand>
{
    public UpdateExchangeRateValidator()
    {
        RuleFor(x => x.Rate)
            .GreaterThan(0).WithMessage("Rate must be greater than zero.");
    }
}

public sealed record DeleteExchangeRateCommand(Guid Id) : ICommand;

/// <summary>Fetches live USD-based rates from the online provider and upserts today's rows.</summary>
public sealed record RefreshExchangeRatesCommand() : ICommand<RefreshExchangeRatesDto>;
