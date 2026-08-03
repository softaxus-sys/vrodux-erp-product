using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Reservations.Dtos;
using Softaxis.Restaurant.Application.Reservations.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reservations;

internal sealed class GetReservationsSummaryHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetReservationsSummaryQuery, ReservationsSummaryDto>
{
    public async Task<Result<ReservationsSummaryDto>> Handle(GetReservationsSummaryQuery query, CancellationToken ct)
    {
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var all = await BranchScope.Apply(db.Reservations.AsNoTracking().Where(x => !x.IsDeleted), accessible)
            .Select(x => new { x.Status, x.ReservationDate, x.Covers }).ToListAsync(ct);

        var dto = new ReservationsSummaryDto(
            Total: all.Count,
            Confirmed: all.Count(x => x.Status == "confirmed"),
            Seated: all.Count(x => x.Status == "seated"),
            Completed: all.Count(x => x.Status == "completed"),
            Cancelled: all.Count(x => x.Status == "cancelled"),
            NoShow: all.Count(x => x.Status == "no_show"),
            Today: all.Count(x => x.ReservationDate == today),
            TodayCovers: all.Where(x => x.ReservationDate == today && x.Status != "cancelled").Sum(x => x.Covers));

        return Result.Success(dto);
    }
}
