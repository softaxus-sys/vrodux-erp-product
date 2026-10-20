using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal static class StayErrors
{
    public static Error Conflict(string message) => Error.Custom("Booking.Conflict", message);

    // The tenant filter replaces the entity's soft-delete filter, so a deleted booking is excluded by hand.
    public static Task<Booking?> LoadAsync(HospitalityDbContext db, Guid id, CancellationToken ct) =>
        db.Bookings.FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted, ct);
}

internal sealed class CheckInBookingHandler(HospitalityDbContext db) : ICommandHandler<CheckInBookingCommand, BookingStatusDto>
{
    public async Task<Result<BookingStatusDto>> Handle(CheckInBookingCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingStatusDto>(Error.NotFoundById("Booking", cmd.Id));
        if (booking.Status != "confirmed")
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"Only a confirmed booking can check in; this one is {booking.Status.Replace('_', ' ')}."));

        var today = HotelDates.Today(cmd.Today);
        if (string.CompareOrdinal(booking.CheckIn, today) > 0)
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"This guest arrives on {booking.CheckIn}. Change the arrival date to check them in early."));
        if (string.CompareOrdinal(booking.CheckOut, today) <= 0)
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"This stay ended on {booking.CheckOut}. Amend the dates or mark it a no-show."));

        // A switch of room at arrival (the booked one is not ready) goes through the same overlap check as a move.
        if (cmd.RoomId is not null && cmd.RoomId != booking.RoomId)
        {
            var moved = await RoomMove.ApplyAsync(db, booking, cmd.RoomId.Value, false, ct);
            if (moved.IsFailure) return Result.Failure<BookingStatusDto>(moved.Error);
        }

        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId && !r.IsDeleted, ct);
        if (room is null) return Result.Failure<BookingStatusDto>(Error.NotFoundById("Room", booking.RoomId));
        if (room.Status == "maintenance")
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"Room {room.RoomNumber} is out of service. Move the guest to another room."));
        if (room.CurrentBookingId is not null && room.CurrentBookingId != booking.BookingNumber)
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"Room {room.RoomNumber} still has a guest in it ({room.CurrentGuestName}). Check them out or move this guest."));

        booking.DoCheckIn();
        room.CheckIn(booking.GuestName, booking.BookingNumber);
        await db.SaveChangesAsync(ct);
        return Result.Success(new BookingStatusDto(booking.Id, booking.Status));
    }
}

internal sealed class CheckOutBookingHandler(HospitalityDbContext db) : ICommandHandler<CheckOutBookingCommand, BookingStatusDto>
{
    public async Task<Result<BookingStatusDto>> Handle(CheckOutBookingCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingStatusDto>(Error.NotFoundById("Booking", cmd.Id));
        if (booking.Status != "checked_in")
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"Only a guest in house can check out; this booking is {booking.Status.Replace('_', ' ')}."));

        var nights = await Folio.NightsAsync(db, booking, ct);
        await Folio.RecalculateAsync(db, booking, nights, ct);
        if (booking.Balance > 0.005m && !cmd.AllowBalance)
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict(
                $"{booking.Balance:N2} is still owed. Take payment, or check out with the balance left open (company or agent to pay)."));

        var today = HotelDates.Today(cmd.Today);
        booking.DoCheckOut();

        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId && !r.IsDeleted, ct);
        if (room is not null)
        {
            room.CheckOut();
            // Housekeeping learns about a departure from the departure itself, not from someone remembering to tell them.
            db.HousekeepingTasks.Add(new HousekeepingTask(room.Id, room.RoomNumber, "checkout", "high",
                $"Departure: {booking.GuestName} ({booking.BookingNumber})"));
        }

        if (booking.GuestId is not null)
        {
            var guest = await db.Guests.FirstOrDefaultAsync(g => g.Id == booking.GuestId, ct);
            guest?.RecordStay(booking.TotalAmount, today);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new BookingStatusDto(booking.Id, booking.Status));
    }
}

internal sealed class AmendStayHandler(HospitalityDbContext db) : ICommandHandler<AmendStayCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(AmendStayCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingDto>(Error.NotFoundById("Booking", cmd.Id));
        if (!booking.IsOpen)
            return Result.Failure<BookingDto>(StayErrors.Conflict($"A {booking.Status.Replace('_', ' ')} booking cannot be changed."));
        if (booking.Status == "checked_in" && cmd.CheckIn != booking.CheckIn)
            return Result.Failure<BookingDto>(StayErrors.Conflict("The guest is already in house, so only the departure date can change."));

        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId && !r.IsDeleted, ct);
        if (room is null) return Result.Failure<BookingDto>(Error.NotFoundById("Room", booking.RoomId));

        var why = await Occupancy.WhyUnavailableAsync(db, room, cmd.CheckIn, cmd.CheckOut, booking.Id, ct);
        if (why is not null && room.Status != "maintenance") return Result.Failure<BookingDto>(StayErrors.Conflict(why));

        var settings = await PmsBootstrap.SettingsAsync(db, ct);
        var type = room.RoomTypeId is null ? null : await db.RoomTypes.FirstOrDefaultAsync(t => t.Id == room.RoomTypeId, ct);
        // Nights already on the booking keep the price the guest agreed; only new nights are priced now.
        var nights = await Folio.RepriceAsync(db, booking, settings, room, type, cmd.CheckIn, cmd.CheckOut, true, ct);
        booking.SetDates(cmd.CheckIn, cmd.CheckOut);
        await Folio.RecalculateAsync(db, booking, nights, ct);

        await db.SaveChangesAsync(ct);
        return Result.Success(BookingMappings.ToDto(booking));
    }
}

internal sealed class UpdateBookingDetailsHandler(HospitalityDbContext db) : ICommandHandler<UpdateBookingDetailsCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(UpdateBookingDetailsCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingDto>(Error.NotFoundById("Booking", cmd.Id));

        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId, ct);
        if (room is not null && cmd.Adults + cmd.Children > room.Capacity)
            return Result.Failure<BookingDto>(StayErrors.Conflict($"Room {room.RoomNumber} sleeps {room.Capacity}."));

        booking.UpdateGuestDetails(cmd.GuestName.Trim(), cmd.GuestEmail?.Trim() ?? "", cmd.GuestPhone?.Trim() ?? "",
            cmd.GuestNationality?.Trim() ?? "", cmd.Adults, cmd.Children, cmd.Source.Trim().ToLowerInvariant(), cmd.SpecialRequests);
        booking.LinkPms(booking.GuestId, booking.RoomTypeId, booking.RatePlanId, booking.RatePlanName, booking.MealPlan,
            booking.ServiceChargePercent, booking.TaxPercent, booking.NightlyFee, cmd.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(BookingMappings.ToDto(booking));
    }
}

/// <summary>Shared by Move and by a room swap at check-in.</summary>
internal static class RoomMove
{
    public static async Task<Result> ApplyAsync(HospitalityDbContext db, Booking booking, Guid roomId, bool reprice, CancellationToken ct)
    {
        var target = await db.Rooms.FirstOrDefaultAsync(r => r.Id == roomId && !r.IsDeleted, ct);
        if (target is null) return Result.Failure(Error.NotFoundById("Room", roomId));
        if (target.Id == booking.RoomId) return Result.Success();
        if (booking.Adults + booking.Children > target.Capacity)
            return Result.Failure(StayErrors.Conflict($"Room {target.RoomNumber} sleeps {target.Capacity}; this party is {booking.Adults + booking.Children}."));

        // For a guest already in house the move covers what is left of the stay, from tonight.
        var from = booking.Status == "checked_in"
            ? HotelDates.Today(null) is var t && string.CompareOrdinal(t, booking.CheckIn) > 0 ? t : booking.CheckIn
            : booking.CheckIn;
        var why = await Occupancy.WhyUnavailableAsync(db, target, from, booking.CheckOut, booking.Id, ct);
        if (why is not null) return Result.Failure(StayErrors.Conflict(why));

        var type = target.RoomTypeId is null ? null : await db.RoomTypes.FirstOrDefaultAsync(x => x.Id == target.RoomTypeId, ct);
        var oldRoom = await db.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId, ct);

        booking.MoveTo(target.Id, target.RoomNumber, type?.Name ?? target.RoomType, target.RoomTypeId);
        if (booking.Status == "checked_in")
        {
            oldRoom?.CheckOut();
            if (oldRoom is not null)
                db.HousekeepingTasks.Add(new HousekeepingTask(oldRoom.Id, oldRoom.RoomNumber, "checkout", "normal",
                    $"Guest moved to {target.RoomNumber} ({booking.BookingNumber})"));
            target.CheckIn(booking.GuestName, booking.BookingNumber);
        }

        if (reprice)
        {
            var settings = await PmsBootstrap.SettingsAsync(db, ct);
            var nights = await Folio.RepriceAsync(db, booking, settings, target, type, booking.CheckIn, booking.CheckOut, false, ct);
            await Folio.RecalculateAsync(db, booking, nights, ct);
        }
        return Result.Success();
    }
}

internal sealed class MoveRoomHandler(HospitalityDbContext db) : ICommandHandler<MoveRoomCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(MoveRoomCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingDto>(Error.NotFoundById("Booking", cmd.Id));
        if (!booking.IsOpen)
            return Result.Failure<BookingDto>(StayErrors.Conflict($"A {booking.Status.Replace('_', ' ')} booking cannot change room."));

        var moved = await RoomMove.ApplyAsync(db, booking, cmd.RoomId, cmd.Reprice, ct);
        if (moved.IsFailure) return Result.Failure<BookingDto>(moved.Error);

        await db.SaveChangesAsync(ct);
        return Result.Success(BookingMappings.ToDto(booking));
    }
}

internal sealed class CancelBookingHandler(HospitalityDbContext db) : ICommandHandler<CancelBookingCommand, BookingStatusDto>
{
    public async Task<Result<BookingStatusDto>> Handle(CancelBookingCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingStatusDto>(Error.NotFoundById("Booking", cmd.Id));
        if (booking.Status != "confirmed")
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict(booking.Status == "checked_in"
                ? "The guest is in house. Shorten the stay and check them out instead."
                : $"A {booking.Status.Replace('_', ' ')} booking cannot be cancelled."));

        await CloseWithFeeAsync(db, booking, cmd.CancellationFee, "cancellation_fee", "Cancellation fee", ct);
        booking.Cancel(cmd.Reason);
        await db.SaveChangesAsync(ct);
        return Result.Success(new BookingStatusDto(booking.Id, booking.Status));
    }

    /// <summary>
    /// A stay that will not happen owes no nights. What it owes instead — a cancellation or no-show
    /// fee — becomes a folio line, so the bill says what was charged and why. Payments already taken
    /// stay recorded; anything above the fee shows as a credit to refund.
    /// </summary>
    public static async Task CloseWithFeeAsync(HospitalityDbContext db, Booking booking, decimal? fee,
        string category, string description, CancellationToken ct)
    {
        var nights = await Folio.NightsAsync(db, booking, ct);
        db.BookingNights.RemoveRange(nights);
        if (fee is > 0)
            db.FolioCharges.Add(new FolioCharge(booking.Id, HotelDates.Today(null), category, description, 1, fee.Value, null));
        await Folio.RecalculateAsync(db, booking, [], ct);
    }
}

internal sealed class MarkNoShowHandler(HospitalityDbContext db) : ICommandHandler<MarkNoShowCommand, BookingStatusDto>
{
    public async Task<Result<BookingStatusDto>> Handle(MarkNoShowCommand cmd, CancellationToken ct)
    {
        var booking = await StayErrors.LoadAsync(db, cmd.Id, ct);
        if (booking is null) return Result.Failure<BookingStatusDto>(Error.NotFoundById("Booking", cmd.Id));
        if (booking.Status != "confirmed")
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict("Only a confirmed booking that never arrived can be a no-show."));
        if (string.CompareOrdinal(booking.CheckIn, HotelDates.Today(cmd.Today)) > 0)
            return Result.Failure<BookingStatusDto>(StayErrors.Conflict($"The guest is not due until {booking.CheckIn}."));

        await CancelBookingHandler.CloseWithFeeAsync(db, booking, cmd.NoShowFee, "cancellation_fee", "No-show charge", ct);
        booking.MarkNoShow();
        await db.SaveChangesAsync(ct);
        return Result.Success(new BookingStatusDto(booking.Id, booking.Status));
    }
}
