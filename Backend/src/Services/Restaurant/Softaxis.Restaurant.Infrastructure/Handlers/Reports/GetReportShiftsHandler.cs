using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reports.Dtos;
using Softaxis.Restaurant.Application.Reports.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reports;

internal sealed class GetReportShiftsHandler(RestaurantDbContext db)
    : IQueryHandler<GetReportShiftsQuery, IReadOnlyList<ReportShiftDto>>
{
    public async Task<Result<IReadOnlyList<ReportShiftDto>>> Handle(GetReportShiftsQuery query, CancellationToken ct)
    {
        var shifts = await PosSessionLedger.GetRecentSessionsAsync(db, 100, ct);
        var ids = shifts.Select(s => s.Id).ToList();

        // Restaurant orders rung up on each shift — a retail-only shift shows 0.
        var counts = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.SessionId != null && ids.Contains(o.SessionId.Value))
            .GroupBy(o => o.SessionId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        IReadOnlyList<ReportShiftDto> result = shifts
            .Select(s => new ReportShiftDto(s.Id, s.Status == 1 ? "open" : "closed", s.RegisterId, s.CashierName,
                s.OpenedAt, s.ClosedAt, counts.GetValueOrDefault(s.Id)))
            .ToList();
        return Result.Success(result);
    }
}
