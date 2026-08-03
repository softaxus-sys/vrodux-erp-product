using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Dashboard.Dtos;
using Softaxis.Restaurant.Application.Dashboard.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Dashboard;

internal sealed class GetOwnerDashboardHandler(RestaurantDbContext db)
    : IQueryHandler<GetOwnerDashboardQuery, OwnerDashboardDto>
{
    public async Task<Result<OwnerDashboardDto>> Handle(GetOwnerDashboardQuery query, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayFrom = ReportAggregation.StartOf(today);
        var todayTo = ReportAggregation.EndOfExclusive(today);
        var weekFrom = ReportAggregation.StartOf(today.AddDays(-6));

        var todayOrders = await ReportAggregation.PaidOrdersInRange(db, todayFrom, todayTo, query.BranchId)
            .Select(o => new { o.SubTotal, o.Total })
            .ToListAsync(ct);

        var weekOrders = await ReportAggregation.PaidOrdersInRange(db, weekFrom, todayTo, query.BranchId)
            .Select(o => new { o.SubTotal, o.Total, o.DiscountAmount })
            .ToListAsync(ct);

        var weekVoidValue = await ReportAggregation.GetVoidValueInRangeAsync(db, weekFrom, todayTo, query.BranchId, ct);
        var topCategories = await ReportAggregation.TopCategoriesAsync(db, weekFrom, todayTo, query.BranchId, take: 5, ct);

        var dto = new OwnerDashboardDto(
            TodaySales: todayOrders.Sum(o => o.SubTotal),
            TodayOrders: todayOrders.Count,
            TodayNetSales: todayOrders.Sum(o => o.Total),
            WeekSales: weekOrders.Sum(o => o.SubTotal),
            WeekNetSales: weekOrders.Sum(o => o.Total),
            WeekDiscounts: weekOrders.Sum(o => o.DiscountAmount),
            WeekVoidValue: weekVoidValue,
            TopCategoriesWeek: topCategories);

        return Result.Success(dto);
    }
}
