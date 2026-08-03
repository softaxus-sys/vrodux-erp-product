using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

internal sealed class GetTaxSummaryReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetTaxSummaryReportQuery, IReadOnlyList<TaxSummaryRow>>
{
    public async Task<Result<IReadOnlyList<TaxSummaryRow>>> Handle(GetTaxSummaryReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        // TaxableAmount = SubTotal (not SubTotal-Discount) — matches how Order.Recalculate actually
        // computes TaxAmount (flat 5% of SubTotal, before discount), so this reflects what the tax was
        // really calculated against rather than a "should have been" figure.
        var rows = await ReportAggregation.PaidOrdersInRange(db, from, to, query.BranchId)
            .GroupBy(o => o.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Taxable = g.Sum(x => x.SubTotal), Tax = g.Sum(x => x.TaxAmount) })
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        IReadOnlyList<TaxSummaryRow> result = rows
            .Select(x => new TaxSummaryRow(DateOnly.FromDateTime(x.Date), x.Taxable, x.Tax))
            .ToList();

        return Result.Success(result);
    }
}
