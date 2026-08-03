using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reservations.Commands;
using Softaxis.Restaurant.Application.Reservations.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reservations;

internal sealed class SeatReservationHandler(RestaurantDbContext db)
    : ICommandHandler<SeatReservationCommand, ReservationStatusDto>
{
    public async Task<Result<ReservationStatusDto>> Handle(SeatReservationCommand cmd, CancellationToken ct)
    {
        var r = await db.Reservations.FindAsync([cmd.Id], ct);
        if (r is null || r.IsDeleted)
            return Result.Failure<ReservationStatusDto>(Error.NotFoundById("Reservation", cmd.Id));

        r.Seat();
        await db.SaveChangesAsync(ct);

        return Result.Success(new ReservationStatusDto(r.Id, r.Status));
    }
}

internal sealed class CancelReservationHandler(RestaurantDbContext db)
    : ICommandHandler<CancelReservationCommand, ReservationStatusDto>
{
    public async Task<Result<ReservationStatusDto>> Handle(CancelReservationCommand cmd, CancellationToken ct)
    {
        var r = await db.Reservations.FindAsync([cmd.Id], ct);
        if (r is null || r.IsDeleted)
            return Result.Failure<ReservationStatusDto>(Error.NotFoundById("Reservation", cmd.Id));

        r.Cancel();
        await db.SaveChangesAsync(ct);

        return Result.Success(new ReservationStatusDto(r.Id, r.Status));
    }
}
