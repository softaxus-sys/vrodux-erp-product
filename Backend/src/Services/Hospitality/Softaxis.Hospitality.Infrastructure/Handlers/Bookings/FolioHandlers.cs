using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Application.Bookings.Queries;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal static class FolioReader
{
    public static async Task<FolioDto> BuildAsync(HospitalityDbContext db, Booking b, CancellationToken ct)
    {
        var settings = await PmsBootstrap.SettingsAsync(db, ct);
        var nights = await db.BookingNights.AsNoTracking().Where(n => n.BookingId == b.Id).OrderBy(n => n.Date).ToListAsync(ct);
        var nightDtos = nights.Count > 0
            ? nights.Select(n => new NightRateDto(n.Date, n.Rate,
                HotelDates.TryParse(n.Date, out var d) && settings.IsWeekendNight(d))).ToList()
            // Booked before the PMS and never touched since: show the nights at the rate sold.
            : HotelDates.Nights(b.CheckIn, b.CheckOut).Where(_ => b.Status is not ("cancelled" or "no_show"))
                .Select(d => new NightRateDto(HotelDates.Text(d), b.RatePerNight, settings.IsWeekendNight(d))).ToList();

        var charges = await db.FolioCharges.AsNoTracking().Where(c => c.BookingId == b.Id)
            .OrderBy(c => c.Date).ThenBy(c => c.CreatedAt).ToListAsync(ct);
        var payments = await db.BookingPayments.AsNoTracking().Where(p => p.BookingId == b.Id)
            .OrderBy(p => p.PaidOn).ThenBy(p => p.CreatedAt).ToListAsync(ct);

        var roomCharge = nights.Count > 0 || b.RoomCharge > 0 ? b.RoomCharge : nightDtos.Sum(n => n.Rate);
        return new FolioDto(
            b.Id, b.BookingNumber, b.Status, b.GuestName, b.RoomNumber, b.CheckIn, b.CheckOut,
            nightDtos,
            charges.Select(c => new FolioChargeDto(c.Id, c.Date, c.Category, c.Description, c.Quantity, c.UnitPrice,
                c.Amount, c.PostedBy, c.IsVoided, c.VoidReason)).ToList(),
            payments.Select(p => new BookingPaymentDto(p.Id, p.BookingId, p.Amount, p.Method, p.PaidOn, p.Reference,
                b.PaidAmount, b.Balance)).ToList(),
            roomCharge, b.ExtrasTotal, b.DiscountAmount, b.DiscountReason,
            b.ServiceChargePercent, b.ServiceAmount, b.TaxPercent, settings.TaxLabel, b.TaxAmount,
            b.NightlyFee, settings.NightlyFeeLabel, b.FeeAmount,
            b.TotalAmount, b.PaidAmount, b.Balance);
    }
}

internal sealed class GetFolioHandler(HospitalityDbContext db) : IQueryHandler<GetFolioQuery, FolioDto>
{
    public async Task<Result<FolioDto>> Handle(GetFolioQuery q, CancellationToken ct)
    {
        var b = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.BookingId && !x.IsDeleted, ct);
        return b is null
            ? Result.Failure<FolioDto>(Error.NotFoundById("Booking", q.BookingId))
            : Result.Success(await FolioReader.BuildAsync(db, b, ct));
    }
}

internal sealed class PostFolioChargeHandler(HospitalityDbContext db) : ICommandHandler<PostFolioChargeCommand, FolioDto>
{
    public async Task<Result<FolioDto>> Handle(PostFolioChargeCommand cmd, CancellationToken ct)
    {
        var b = await StayErrors.LoadAsync(db, cmd.BookingId, ct);
        if (b is null) return Result.Failure<FolioDto>(Error.NotFoundById("Booking", cmd.BookingId));
        if (b.Status is not ("confirmed" or "checked_in"))
            return Result.Failure<FolioDto>(StayErrors.Conflict($"Charges can only be posted to an open stay; this one is {b.Status.Replace('_', ' ')}."));

        var date = string.IsNullOrWhiteSpace(cmd.Date) ? HotelDates.Today(null) : cmd.Date!;
        db.FolioCharges.Add(new FolioCharge(b.Id, date, cmd.Category, cmd.Description, cmd.Quantity, cmd.UnitPrice, cmd.PostedBy));
        var nights = await Folio.NightsAsync(db, b, ct);
        await Folio.RecalculateAsync(db, b, nights, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(await FolioReader.BuildAsync(db, b, ct));
    }
}

internal sealed class VoidFolioChargeHandler(HospitalityDbContext db) : ICommandHandler<VoidFolioChargeCommand, FolioDto>
{
    public async Task<Result<FolioDto>> Handle(VoidFolioChargeCommand cmd, CancellationToken ct)
    {
        var b = await StayErrors.LoadAsync(db, cmd.BookingId, ct);
        if (b is null) return Result.Failure<FolioDto>(Error.NotFoundById("Booking", cmd.BookingId));
        if (b.Status == "checked_out")
            return Result.Failure<FolioDto>(StayErrors.Conflict("The guest has checked out; the bill is closed."));

        var charge = await db.FolioCharges.FirstOrDefaultAsync(c => c.Id == cmd.ChargeId && c.BookingId == b.Id, ct);
        if (charge is null) return Result.Failure<FolioDto>(Error.NotFoundById("FolioCharge", cmd.ChargeId));
        if (charge.IsVoided) return Result.Failure<FolioDto>(StayErrors.Conflict("That charge is already voided."));

        // Voided, not deleted: the line stays on the bill with the reason, so a correction is visible.
        charge.Void(cmd.Reason);
        var nights = await Folio.NightsAsync(db, b, ct);
        await db.SaveChangesAsync(ct);
        await Folio.RecalculateAsync(db, b, nights, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(await FolioReader.BuildAsync(db, b, ct));
    }
}

internal sealed class SetBookingDiscountHandler(HospitalityDbContext db) : ICommandHandler<SetBookingDiscountCommand, FolioDto>
{
    public async Task<Result<FolioDto>> Handle(SetBookingDiscountCommand cmd, CancellationToken ct)
    {
        var b = await StayErrors.LoadAsync(db, cmd.BookingId, ct);
        if (b is null) return Result.Failure<FolioDto>(Error.NotFoundById("Booking", cmd.BookingId));
        if (!b.IsOpen)
            return Result.Failure<FolioDto>(StayErrors.Conflict($"A {b.Status.Replace('_', ' ')} booking's bill cannot be discounted."));

        var nights = await Folio.NightsAsync(db, b, ct);
        var room = nights.Sum(n => n.Rate);
        if (cmd.Amount > room + b.ExtrasTotal)
            return Result.Failure<FolioDto>(StayErrors.Conflict("The discount is more than the bill before tax."));

        b.SetDiscount(cmd.Amount, cmd.Reason);
        await Folio.RecalculateAsync(db, b, nights, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(await FolioReader.BuildAsync(db, b, ct));
    }
}

internal sealed class GetBookingByIdHandler(HospitalityDbContext db) : IQueryHandler<GetBookingByIdQuery, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(GetBookingByIdQuery q, CancellationToken ct)
    {
        var b = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        return b is null ? Result.Failure<BookingDto>(Error.NotFoundById("Booking", q.Id)) : Result.Success(BookingMappings.ToDto(b));
    }
}

/// <summary>
/// Today at the desk. Occupancy and rates are over tonight: rooms that hold an in-house or arriving
/// guest for tonight, against rooms that can be sold (out-of-service rooms are excluded from both).
/// </summary>
internal sealed class GetFrontDeskHandler(HospitalityDbContext db) : IQueryHandler<GetFrontDeskQuery, FrontDeskDto>
{
    public async Task<Result<FrontDeskDto>> Handle(GetFrontDeskQuery q, CancellationToken ct)
    {
        var today = HotelDates.Today(q.Today);
        var tomorrow = HotelDates.TryParse(today, out var t) ? HotelDates.Text(t.AddDays(1)) : today;

        var rooms = await db.Rooms.AsNoTracking().Where(r => !r.IsDeleted).ToListAsync(ct);
        var blocked = await Occupancy.OverlappingBlocks(db, today, tomorrow).Select(b => b.RoomId).Distinct().ToListAsync(ct);
        var outOfOrder = rooms.Count(r => r.Status == "maintenance" || blocked.Contains(r.Id));
        var sellable = Math.Max(0, rooms.Count - outOfOrder);

        var relevant = await db.Bookings.AsNoTracking()
            .Where(b => !b.IsDeleted && (
                (b.Status == "confirmed" && string.Compare(b.CheckIn, today) <= 0 && string.Compare(b.CheckOut, today) > 0) ||
                (b.Status == "confirmed" && string.Compare(b.CheckIn, today) < 0) ||
                b.Status == "checked_in" ||
                (b.Status == "checked_out" && b.CheckOut == today) ||
                (b.Status == "confirmed" && b.CheckIn == today)))
            .ToListAsync(ct);

        var arrivals = relevant.Where(b => b.Status == "confirmed" && b.CheckIn == today).OrderBy(b => b.GuestName).ToList();
        var inHouse = relevant.Where(b => b.Status == "checked_in").OrderBy(b => b.RoomNumber).ToList();
        var departures = relevant.Where(b => (b.Status == "checked_in" && string.CompareOrdinal(b.CheckOut, today) <= 0)
                                          || (b.Status == "checked_out" && b.CheckOut == today))
            .OrderBy(b => b.RoomNumber).ToList();
        var noShows = relevant.Where(b => b.Status == "confirmed" && string.CompareOrdinal(b.CheckIn, today) < 0)
            .OrderBy(b => b.CheckIn).ToList();

        // Tonight's sold rooms: in house and not leaving today, plus today's arrivals.
        var tonight = inHouse.Where(b => string.CompareOrdinal(b.CheckOut, today) > 0).Concat(arrivals).ToList();
        var tonightIds = tonight.Select(b => b.Id).ToList();
        var revenue = await db.BookingNights.AsNoTracking()
            .Where(n => tonightIds.Contains(n.BookingId) && n.Date == today).SumAsync(n => (decimal?)n.Rate, ct) ?? 0m;
        // Pre-PMS bookings have no priced nights; count them at the rate they were sold.
        var priced = await db.BookingNights.AsNoTracking().Where(n => tonightIds.Contains(n.BookingId) && n.Date == today)
            .Select(n => n.BookingId).ToListAsync(ct);
        revenue += tonight.Where(b => !priced.Contains(b.Id)).Sum(b => b.RatePerNight);

        var sold = tonight.Select(b => b.RoomId).Distinct().Count();
        var occupancy = sellable == 0 ? 0 : Math.Round(100.0 * sold / sellable, 1);
        var adr = sold == 0 ? 0 : Math.Round(revenue / sold, 2);
        var revPar = sellable == 0 ? 0 : Math.Round(revenue / sellable, 2);

        return Result.Success(new FrontDeskDto(
            today, rooms.Count, outOfOrder, sold, occupancy, adr, revPar, revenue,
            rooms.Count(r => r.HousekeepingStatus == "dirty"),
            arrivals.Count, departures.Count(b => b.Status == "checked_in"),
            arrivals.Select(BookingMappings.ToDto).ToList(),
            departures.Select(BookingMappings.ToDto).ToList(),
            inHouse.Select(BookingMappings.ToDto).ToList(),
            noShows.Select(BookingMappings.ToDto).ToList()));
    }
}
