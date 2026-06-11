using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class CheckOutBookingHandler(HospitalityDbContext db) : ICommandHandler<CheckOutBookingCommand, BookingStatusDto>
{
    public async Task<Result<BookingStatusDto>> Handle(CheckOutBookingCommand command, CancellationToken ct)
    {
        var booking = await db.Bookings.FindAsync([command.Id], ct);
        if (booking is null)
        {
            return Result.Failure<BookingStatusDto>(Error.NotFoundById("Booking", command.Id));
        }

        var room = await db.Rooms.FindAsync([booking.RoomId], ct);
        booking.DoCheckOut();
        room?.CheckOut();

        await db.SaveChangesAsync(ct);

        return Result.Success(new BookingStatusDto(booking.Id, booking.Status));
    }
}
