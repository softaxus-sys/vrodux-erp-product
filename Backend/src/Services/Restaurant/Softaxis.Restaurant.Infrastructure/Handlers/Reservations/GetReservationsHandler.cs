using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Reservations.Dtos;
using Softaxis.Restaurant.Application.Reservations.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reservations;

internal sealed class GetReservationsHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetReservationsQuery, IReadOnlyList<ReservationDto>>
{
    public async Task<Result<IReadOnlyList<ReservationDto>>> Handle(GetReservationsQuery query, CancellationToken ct)
    {
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var q = BranchScope.Apply(db.Reservations.AsNoTracking().Where(x => !x.IsDeleted), accessible);
        if (!string.IsNullOrEmpty(query.Date)) q = q.Where(x => x.ReservationDate == query.Date);

        var items = await q.OrderBy(x => x.ReservationDate).ThenBy(x => x.ReservationTime)
            .Select(r => new ReservationDto(
                r.Id, r.ReservationNumber, r.BranchId, r.TableId, r.TableNumber,
                r.GuestName, r.GuestPhone, r.GuestEmail, r.Covers,
                r.ReservationDate, r.ReservationTime, r.Status, r.SpecialRequests,
                r.ArrivalWindowStart, r.ArrivalWindowEnd, r.NoShowAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ReservationDto>>(items);
    }
}
