using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ExchangeRates.Commands;
using Softaxis.Finance.Application.ExchangeRates.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ExchangeRates;

internal sealed class UpdateExchangeRateHandler(FinanceDbContext db)
    : ICommandHandler<UpdateExchangeRateCommand, ExchangeRateDto>
{
    public async Task<Result<ExchangeRateDto>> Handle(UpdateExchangeRateCommand cmd, CancellationToken ct)
    {
        var rate = await db.ExchangeRates.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (rate is null)
            return Result.Failure<ExchangeRateDto>(Error.NotFoundById(nameof(ExchangeRate), cmd.Id));

        rate.Update(cmd.Rate);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ExchangeRateDto(rate.Id, rate.CurrencyCode, rate.RateDate, rate.Rate, rate.CreatedAt, rate.UpdatedAt));
    }
}
