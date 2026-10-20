using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class CreateBookingHandler(HospitalityDbContext db) : ICommandHandler<CreateBookingCommand, CreateBookingResultDto>
{
    public async Task<Result<CreateBookingResultDto>> Handle(CreateBookingCommand cmd, CancellationToken ct)
    {
        await PmsBootstrap.EnsureRoomTypesAsync(db, ct);
        var room = await db.Rooms.FirstOrDefaultAsync(r => r.Id == cmd.RoomId && !r.IsDeleted, ct);
        if (room is null) return Result.Failure<CreateBookingResultDto>(Error.NotFoundById("Room", cmd.RoomId));
        var type = room.RoomTypeId is null ? null
            : await db.RoomTypes.FirstOrDefaultAsync(t => t.Id == room.RoomTypeId && !t.IsDeleted, ct);

        if (cmd.Adults + cmd.Children > room.Capacity)
            return Fail($"Room {room.RoomNumber} sleeps {room.Capacity}; this party is {cmd.Adults + cmd.Children}.");

        // A double booking is the one mistake a hotel cannot undo at the desk, so it is refused here,
        // not merely hidden in the room picker.
        var why = await Occupancy.WhyUnavailableAsync(db, room, cmd.CheckIn, cmd.CheckOut, null, ct);
        if (why is not null) return Fail(why);

        var settings = await PmsBootstrap.SettingsAsync(db, ct);
        var plan = cmd.RatePlanId is null
            ? await PmsBootstrap.DefaultPlanAsync(db, ct)
            : await db.RatePlans.FirstOrDefaultAsync(p => p.Id == cmd.RatePlanId && !p.IsDeleted, ct);
        if (plan is null) return Result.Failure<CreateBookingResultDto>(Error.NotFoundById("RatePlan", cmd.RatePlanId!));
        if (!plan.IsActive) return Fail($"The rate plan {plan.Name} is switched off.");

        var dates = HotelDates.Nights(cmd.CheckIn, cmd.CheckOut);
        var priced = await Pricing.PriceAsync(db, settings, plan.Id, room.RoomTypeId, room.RatePerNight, type?.BaseRate ?? 0, dates, ct);
        var minNights = priced.Max(p => p.MinNights);
        if (dates.Count < minNights)
            return Fail($"This rate needs a stay of at least {minNights} nights on these dates.");
        if (priced.Any(p => p.Rate <= 0))
            return Fail($"There is no price for room {room.RoomNumber} on some of these nights. Set a rate on the room type or the rate plan.");

        var guest = await ResolveGuestAsync(cmd, ct);
        if (guest is null && cmd.GuestId is not null)
            return Result.Failure<CreateBookingResultDto>(Error.NotFoundById("Guest", cmd.GuestId.Value));

        var booking = new Booking(room.Id, room.RoomNumber, type?.Name ?? room.RoomType,
            cmd.GuestName.Trim(), guest!.Email ?? cmd.GuestEmail?.Trim() ?? "", guest.Phone ?? cmd.GuestPhone?.Trim() ?? "",
            guest.Nationality ?? cmd.GuestNationality?.Trim() ?? "",
            cmd.CheckIn, cmd.CheckOut, dates.Count, cmd.Adults, cmd.Children,
            priced.Count == 0 ? 0 : priced.Average(p => p.Rate), cmd.Source.Trim().ToLowerInvariant(), cmd.SpecialRequests);
        booking.LinkPms(guest.Id, room.RoomTypeId, plan.Id, plan.Name, plan.MealPlan,
            settings.ServiceChargePercent, settings.TaxPercent, settings.NightlyFee, cmd.Notes);
        if (cmd.DiscountAmount is > 0) booking.SetDiscount(cmd.DiscountAmount.Value, cmd.DiscountReason);

        var nights = priced.Select(p => new BookingNight(booking.Id, HotelDates.Text(p.Date), p.Rate)).ToList();
        db.Bookings.Add(booking);
        db.BookingNights.AddRange(nights);
        booking.Recalculate(nights, 0);

        if (cmd.DiscountAmount is > 0 && cmd.DiscountAmount > booking.RoomCharge)
            return Fail("The discount is more than the room charge.");

        // A deposit taken at booking is a payment like any other, with its own record.
        if (cmd.PaidAmount is > 0)
        {
            var deposit = Math.Round(cmd.PaidAmount.Value, 2);
            if (deposit > booking.TotalAmount + 0.005m)
                return Fail($"The deposit ({deposit:N2}) is more than the booking total ({booking.TotalAmount:N2}).");
            db.BookingPayments.Add(new BookingPayment(booking.Id, deposit, cmd.PaymentMethod!,
                DateTime.UtcNow.ToString("yyyy-MM-dd"), cmd.PaymentReference));
            booking.RecordPayment(deposit);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new CreateBookingResultDto(booking.Id, booking.BookingNumber, booking.TotalAmount));
    }

    /// <summary>
    /// The profile the stay belongs to: the one picked, else an existing guest with the same email
    /// (then the same phone), else a new profile. Matching keeps a returning guest's history in one
    /// place rather than a new card per visit; an existing profile is only ever filled in, never overwritten.
    /// </summary>
    private async Task<Guest?> ResolveGuestAsync(CreateBookingCommand cmd, CancellationToken ct)
    {
        if (cmd.GuestId is not null)
            return await db.Guests.FirstOrDefaultAsync(g => g.Id == cmd.GuestId && !g.IsDeleted, ct);

        var email = Guest.Norm(cmd.GuestEmail);
        var phone = string.IsNullOrWhiteSpace(cmd.GuestPhone) ? null : cmd.GuestPhone.Trim();
        Guest? match = null;
        if (email is not null) match = await db.Guests.FirstOrDefaultAsync(g => !g.IsDeleted && g.Email == email, ct);
        if (match is null && phone is not null) match = await db.Guests.FirstOrDefaultAsync(g => !g.IsDeleted && g.Phone == phone, ct);

        if (match is not null)
        {
            match.FillGaps(email, phone, cmd.GuestNationality);
            return match;
        }

        var guest = new Guest(cmd.GuestName, email, phone, cmd.GuestNationality);
        db.Guests.Add(guest);
        return guest;
    }

    private static Result<CreateBookingResultDto> Fail(string message) =>
        Result.Failure<CreateBookingResultDto>(Error.Custom("Booking.Conflict", message));
}
