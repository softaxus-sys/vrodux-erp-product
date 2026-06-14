using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.ExchangeRates.Dtos;
using Softaxis.Finance.Application.ExchangeRates.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.ExchangeRates;

internal sealed class GetExchangeRatesHandler(FinanceDbContext db)
    : IQueryHandler<GetExchangeRatesQuery, IReadOnlyList<ExchangeRateDto>>
{
    public async Task<Result<IReadOnlyList<ExchangeRateDto>>> Handle(GetExchangeRatesQuery query, CancellationToken ct)
    {
        var q = db.ExchangeRates.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.CurrencyCode))
            q = q.Where(x => x.CurrencyCode == query.CurrencyCode.Trim().ToUpperInvariant());

        var rates = await q
            .OrderByDescending(x => x.RateDate)
            .ThenBy(x => x.CurrencyCode)
            .Select(x => new ExchangeRateDto(x.Id, x.CurrencyCode, x.RateDate, x.Rate, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ExchangeRateDto>>(rates);
    }
}
