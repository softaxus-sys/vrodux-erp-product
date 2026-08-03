using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Dashboard.Dtos;
using Softaxis.Restaurant.Application.Dashboard.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Dashboard;

/// <summary>The acting cashier's own today's totals (scoped by CashierId, resolved server-side from
/// the JWT — never client-supplied) plus, when a SessionId is given, the full Z/X-report snapshot for
/// their current shift.</summary>
internal sealed class GetCashierDashboardHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetCashierDashboardQuery, CashierDashboardDto>
{
    public async Task<Result<CashierDashboardDto>> Handle(GetCashierDashboardQuery query, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayFrom = ReportAggregation.StartOf(today);
        var todayTo = ReportAggregation.EndOfExclusive(today);

        var todayOrders = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status == "paid" && o.CashierId == currentUser.Id
                && o.CreatedAt >= todayFrom && o.CreatedAt < todayTo)
            .Select(o => o.SubTotal)
            .ToListAsync(ct);

        var currentSession = query.SessionId.HasValue
            ? await ReportAggregation.BuildSessionReportAsync(db, query.SessionId.Value, ct)
            : null;

        var dto = new CashierDashboardDto(
            TodayOrders: todayOrders.Count,
            TodaySales: todayOrders.Sum(),
            CurrentSession: currentSession);

        return Result.Success(dto);
    }
}
