using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Application.ExchangeRates.Commands;
using Softaxis.Finance.Application.ExchangeRates.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.ExchangeRates;

internal sealed class RefreshExchangeRatesHandler(FinanceDbContext db, IExchangeRateProvider provider)
    : ICommandHandler<RefreshExchangeRatesCommand, RefreshExchangeRatesDto>
{
    public async Task<Result<RefreshExchangeRatesDto>> Handle(RefreshExchangeRatesCommand cmd, CancellationToken ct)
    {
        var (updated, asOf) = await ExchangeRateUpserter.RefreshAsync(db, provider, ct);
        return Result.Success(new RefreshExchangeRatesDto(updated, asOf));
    }
}
