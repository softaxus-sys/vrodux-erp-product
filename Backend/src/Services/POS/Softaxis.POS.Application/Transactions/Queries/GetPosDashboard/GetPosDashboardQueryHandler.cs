using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Queries.GetPosDashboard;

public sealed class GetPosDashboardQueryHandler(IPOSTransactionRepository txnRepo)
    : IQueryHandler<GetPosDashboardQuery, PosDashboardDto>
{
    public async Task<Result<PosDashboardDto>> Handle(GetPosDashboardQuery query, CancellationToken ct)
    {
        var offset = TimeSpan.FromMinutes(query.UtcOffsetMinutes);

        var localDay = DateTime.TryParse(query.Date, out var parsed)
            ? parsed.Date
            : DateTime.UtcNow.Add(offset).Date;

        // The local day converted back to the UTC window the rows are stored in.
        var startUtc = localDay - offset;
        var endUtc   = startUtc.AddDays(1);

        var (hourly, methods, totalSales, totalCount) =
            await txnRepo.GetDailyBreakdownAsync(startUtc, endUtc, ct);

        // Buckets come back in UTC hours; shift them into the caller's clock so 14:00 on the chart
        // is 2pm at the till.
        var shifted = hourly
            .Select(h => new HourlySalesDto(
                (int)((h.Hour + offset.TotalHours + 24) % 24), h.Sales, h.Count))
            .OrderBy(h => h.Hour)
            .ToList();

        return Result.Success(new PosDashboardDto(
            shifted,
            methods.Select(m => new PaymentMethodCountDto(m.Method, m.Count)).ToList(),
            totalSales,
            totalCount));
    }
}
