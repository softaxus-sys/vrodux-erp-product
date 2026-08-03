using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reservations.Commands;
using Softaxis.Restaurant.Application.Reservations.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reservations;

internal sealed class CreateReservationHandler(RestaurantDbContext db)
    : ICommandHandler<CreateReservationCommand, ReservationCreatedDto>
{
    public async Task<Result<ReservationCreatedDto>> Handle(CreateReservationCommand cmd, CancellationToken ct)
    {
        var r = new Reservation(cmd.GuestName, cmd.GuestPhone, cmd.GuestEmail, cmd.Covers,
            cmd.ReservationDate, cmd.ReservationTime, cmd.SpecialRequests,
            cmd.BranchId, cmd.ArrivalWindowStart, cmd.ArrivalWindowEnd);

        if (cmd.TableId.HasValue)
        {
            var table = await db.Tables.FindAsync([cmd.TableId.Value], ct);
            if (table is not null && !table.IsDeleted)
            {
                r.AssignTable(table.Id, table.TableNumber);
                table.Reserve();
            }
        }

        db.Reservations.Add(r);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ReservationCreatedDto(r.Id, r.ReservationNumber, r.Status));
    }
}
