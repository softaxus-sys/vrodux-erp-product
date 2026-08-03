using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

internal sealed class GetSalesByEmployeeReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetSalesByEmployeeReportQuery, IReadOnlyList<SalesByEmployeeRow>>
{
    public async Task<Result<IReadOnlyList<SalesByEmployeeRow>>> Handle(GetSalesByEmployeeReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        var rows = await ReportAggregation.PaidOrdersInRange(db, from, to, query.BranchId)
            .GroupBy(o => o.Waiter)
            .Select(g => new { Waiter = g.Key, Count = g.Count(), Revenue = g.Sum(x => x.Total), Tips = g.Sum(x => x.TipAmount) })
            .OrderByDescending(x => x.Revenue)
            .ToListAsync(ct);

        IReadOnlyList<SalesByEmployeeRow> result = rows
            .Select(x => new SalesByEmployeeRow(x.Waiter, x.Count, x.Revenue, x.Tips))
            .ToList();

        return Result.Success(result);
    }
}
