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

        if (query.LatestOnly)
        {
            // Newest row per currency, resolved in SQL so the whole history stays out of memory.
            //
            // Written as "no newer row exists for this currency" (a correlated NOT EXISTS) rather
            // than GroupBy(...).Select(g => g.OrderBy(...).First()), which reads more naturally but
            // does NOT translate — EF throws KeyNotFoundException('EmptyProjectionMember') at query
            // time, so it compiles and then fails on the first request.
            //
            // The tie-breakers are what keep it to exactly one row per currency: two rows can share
            // a RateDate (a same-day re-refresh), and in principle a CreatedAt, so Id settles it.
            //
            // RateDate is a yyyy-MM-dd string, so it compares with string.Compare rather than ">" —
            // ordinal order is chronological for that format (the convention used across HR too).
            var latest = await q
                .Where(x => !q.Any(y =>
                    y.CurrencyCode == x.CurrencyCode &&
                    (string.Compare(y.RateDate, x.RateDate) > 0
                     || (y.RateDate == x.RateDate && y.CreatedAt > x.CreatedAt)
                     || (y.RateDate == x.RateDate && y.CreatedAt == x.CreatedAt && y.Id > x.Id))))
                .OrderBy(x => x.CurrencyCode)
                .Select(x => new ExchangeRateDto(x.Id, x.CurrencyCode, x.RateDate, x.Rate, x.CreatedAt, x.UpdatedAt))
                .ToListAsync(ct);

            return Result.Success<IReadOnlyList<ExchangeRateDto>>(latest);
        }

        var rates = await q
            .OrderByDescending(x => x.RateDate)
            .ThenBy(x => x.CurrencyCode)
            .Select(x => new ExchangeRateDto(x.Id, x.CurrencyCode, x.RateDate, x.Rate, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ExchangeRateDto>>(rates);
    }
}
