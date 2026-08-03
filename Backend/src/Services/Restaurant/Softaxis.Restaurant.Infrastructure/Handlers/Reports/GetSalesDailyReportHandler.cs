using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

internal sealed class GetSalesDailyReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetSalesDailyReportQuery, IReadOnlyList<SalesDailyRow>>
{
    public async Task<Result<IReadOnlyList<SalesDailyRow>>> Handle(GetSalesDailyReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        var rows = await ReportAggregation.PaidOrdersInRange(db, from, to, query.BranchId)
            .GroupBy(o => o.CreatedAt.Date)
            .Select(g => new
            {
                Date = g.Key,
                Count = g.Count(),
                Gross = g.Sum(x => x.SubTotal),
                Discounts = g.Sum(x => x.DiscountAmount),
                Tax = g.Sum(x => x.TaxAmount),
                Net = g.Sum(x => x.Total),
            })
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        IReadOnlyList<SalesDailyRow> result = rows
            .Select(x => new SalesDailyRow(DateOnly.FromDateTime(x.Date), x.Count, x.Gross, x.Discounts, x.Tax, x.Net))
            .ToList();

        return Result.Success(result);
    }
}
