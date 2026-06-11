using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class CreateBookingHandler(HospitalityDbContext db) : ICommandHandler<CreateBookingCommand, CreateBookingResultDto>
{
    public async Task<Result<CreateBookingResultDto>> Handle(CreateBookingCommand command, CancellationToken ct)
    {
        var room = await db.Rooms.FindAsync([command.RoomId], ct);
        if (room is null)
        {
            return Result.Failure<CreateBookingResultDto>(Error.NotFoundById("Room", command.RoomId));
        }

        var booking = new Booking(command.RoomId, room.RoomNumber, room.RoomType, command.GuestName, command.GuestEmail,
            command.GuestPhone, command.GuestNationality, command.CheckIn, command.CheckOut, command.Nights,
            command.Adults, command.Children, room.RatePerNight, command.Source, command.SpecialRequests);

        db.Bookings.Add(booking);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CreateBookingResultDto(booking.Id, booking.BookingNumber, booking.TotalAmount));
    }
}
