using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

/// <summary>Derived from Order.CreatedAt/UpdatedAt on paid dine-in orders — there's no dedicated
/// turnover-log table (per the design doc's "no new base tables" guidance), so UpdatedAt-at-payment is
/// used as a proxy for when the table turned.</summary>
internal sealed class GetTableTurnoverReportHandler(RestaurantDbContext db)
    : IQueryHandler<GetTableTurnoverReportQuery, IReadOnlyList<TableTurnoverRow>>
{
    public async Task<Result<IReadOnlyList<TableTurnoverRow>>> Handle(GetTableTurnoverReportQuery query, CancellationToken ct)
    {
        var from = ReportAggregation.StartOf(query.From);
        var to = ReportAggregation.EndOfExclusive(query.To);

        var raw = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status == "paid" && o.OrderType == "dine_in" && o.TableId != Guid.Empty
                && o.CreatedAt >= from && o.CreatedAt < to
                && (query.BranchId == null || o.BranchId == query.BranchId))
            .Select(o => new { o.TableId, o.TableNumber, o.CreatedAt, o.UpdatedAt })
            .ToListAsync(ct);

        IReadOnlyList<TableTurnoverRow> result = raw
            .GroupBy(x => new { x.TableId, x.TableNumber })
            .Select(g => new TableTurnoverRow(
                g.Key.TableId, g.Key.TableNumber, g.Count(),
                Math.Round(g.Average(x => (x.UpdatedAt - x.CreatedAt).TotalMinutes), 1)))
            .OrderByDescending(r => r.TurnCount)
            .ToList();

        return Result.Success(result);
    }
}
