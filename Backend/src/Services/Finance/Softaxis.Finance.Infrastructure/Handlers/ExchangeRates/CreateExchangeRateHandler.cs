using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ExchangeRates.Commands;
using Softaxis.Finance.Application.ExchangeRates.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ExchangeRates;

internal sealed class CreateExchangeRateHandler(FinanceDbContext db)
    : ICommandHandler<CreateExchangeRateCommand, ExchangeRateDto>
{
    public async Task<Result<ExchangeRateDto>> Handle(CreateExchangeRateCommand cmd, CancellationToken ct)
    {
        var code = cmd.CurrencyCode.Trim().ToUpperInvariant();

        var currencyExists = await db.Currencies.AnyAsync(x => x.Code == code, ct);
        if (!currencyExists)
            return Result.Failure<ExchangeRateDto>(Error.Custom("Currency.NotFound", $"Currency '{code}' was not found."));

        var duplicate = await db.ExchangeRates.AnyAsync(x => x.CurrencyCode == code && x.RateDate == cmd.RateDate, ct);
        if (duplicate)
            return Result.Failure<ExchangeRateDto>(Error.Custom("ExchangeRate.Duplicate", $"A rate for '{code}' on {cmd.RateDate} already exists."));

        var rate = new ExchangeRate(code, cmd.RateDate, cmd.Rate);
        db.ExchangeRates.Add(rate);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ExchangeRateDto(rate.Id, rate.CurrencyCode, rate.RateDate, rate.Rate, rate.CreatedAt, rate.UpdatedAt));
    }
}
