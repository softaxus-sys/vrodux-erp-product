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

        // A deposit taken at booking is a payment like any other, with its own record.
        if (command.PaidAmount is > 0)
        {
            var deposit = Math.Round(command.PaidAmount.Value, 2);
            if (deposit > booking.TotalAmount + 0.005m)
                return Result.Failure<CreateBookingResultDto>(Error.Custom("Booking.Conflict",
                    $"The deposit ({deposit:N2}) is more than the booking total ({booking.TotalAmount:N2})."));

            db.BookingPayments.Add(new BookingPayment(booking.Id, deposit, command.PaymentMethod!,
                DateTime.UtcNow.ToString("yyyy-MM-dd"), null));
            booking.RecordPayment(deposit);
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(new CreateBookingResultDto(booking.Id, booking.BookingNumber, booking.TotalAmount));
    }
}
