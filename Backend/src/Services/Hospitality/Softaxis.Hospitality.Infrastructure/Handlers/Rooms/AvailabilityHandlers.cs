using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Rooms.Dtos;
using Softaxis.Hospitality.Application.Rooms.Queries;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Rooms;

internal sealed class SearchAvailabilityHandler(HospitalityDbContext db) : IQueryHandler<SearchAvailabilityQuery, AvailabilityResultDto>
{
    private const int MaxNights = 90;

    public async Task<Result<AvailabilityResultDto>> Handle(SearchAvailabilityQuery q, CancellationToken ct)
    {
        var nights = HotelDates.Nights(q.CheckIn, q.CheckOut);
        if (nights.Count == 0)
            return Result.Failure<AvailabilityResultDto>(Error.Custom("Validation.Failed", "Pick an arrival date before the departure date (yyyy-MM-dd)."));
        if (nights.Count > MaxNights)
            return Result.Failure<AvailabilityResultDto>(Error.Custom("Validation.Failed", $"Search up to {MaxNights} nights at a time."));

        await PmsBootstrap.EnsureRoomTypesAsync(db, ct);
        var settings = await PmsBootstrap.SettingsAsync(db, ct);
        var plan = q.RatePlanId is null
            ? await PmsBootstrap.DefaultPlanAsync(db, ct)
            : await db.RatePlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == q.RatePlanId && !p.IsDeleted, ct);
        if (plan is null) return Result.Failure<AvailabilityResultDto>(Error.NotFoundById("RatePlan", q.RatePlanId!));

        var types = await db.RoomTypes.AsNoTracking()
            .Where(t => !t.IsDeleted && t.IsActive && (q.RoomTypeId == null || t.Id == q.RoomTypeId))
            .OrderBy(t => t.BaseRate).ToListAsync(ct);
        var rooms = await db.Rooms.AsNoTracking().Where(r => !r.IsDeleted && r.RoomTypeId != null).ToListAsync(ct);

        // One query each for everything holding a room on any of these nights.
        var taken = (await Occupancy.Overlapping(db, q.CheckIn, q.CheckOut)
                .Where(b => q.ExcludeBookingId == null || b.Id != q.ExcludeBookingId)
                .Select(b => b.RoomId).ToListAsync(ct))
            .Concat(await Occupancy.OverlappingBlocks(db, q.CheckIn, q.CheckOut).Select(b => b.RoomId).ToListAsync(ct))
            .ToHashSet();

        var party = Math.Max(1, q.Adults) + Math.Max(0, q.Children);
        var result = new List<RoomTypeAvailabilityDto>();
        foreach (var type in types)
        {
            var ofType = rooms.Where(r => r.RoomTypeId == type.Id).ToList();
            var free = ofType.Where(r => r.Status != "maintenance" && !taken.Contains(r.Id) && r.Capacity >= party)
                .OrderBy(r => r.HousekeepingStatus == "dirty").ThenBy(r => r.Floor).ThenBy(r => r.RoomNumber).ToList();

            var seasons = await Pricing.LoadSeasonsAsync(db, plan.Id, type.Id, nights, ct);
            // The quote is for the type's rate; a room with its own rate is priced when booked.
            var priced = Pricing.Price(settings, seasons, 0, type.BaseRate, nights);
            var totals = Pricing.Totals(settings, priced);

            result.Add(new RoomTypeAvailabilityDto(
                type.Id, type.Code, type.Name, type.MaxAdults, type.MaxChildren, ofType.Count, free.Count,
                q.Adults <= type.MaxAdults && q.Children <= type.MaxChildren,
                free.Select(r => new AvailableRoomDto(r.Id, r.RoomNumber, r.Floor, r.View, r.HasBalcony, r.HousekeepingStatus)).ToList(),
                new StayQuoteDto(priced.Select(Pricing.ToDto).ToList(), totals.Room, totals.Service, totals.Tax, totals.Fee, totals.Total,
                    priced.Count == 0 ? 1 : priced.Max(p => p.MinNights))));
        }

        return Result.Success(new AvailabilityResultDto(q.CheckIn, q.CheckOut, nights.Count, plan.Id, plan.Name, result));
    }
}

internal sealed class GetTapeChartHandler(HospitalityDbContext db) : IQueryHandler<GetTapeChartQuery, TapeChartDto>
{
    public async Task<Result<TapeChartDto>> Handle(GetTapeChartQuery q, CancellationToken ct)
    {
        var days = Math.Clamp(q.Days, 1, 62);
        if (!HotelDates.TryParse(HotelDates.Today(null), out var today)) today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = HotelDates.TryParse(q.From, out var f) ? f : today;
        var from = HotelDates.Text(start);
        var to = HotelDates.Text(start.AddDays(days));

        await PmsBootstrap.EnsureRoomTypesAsync(db, ct);
        var rooms = await db.Rooms.AsNoTracking().Where(r => !r.IsDeleted)
            .OrderBy(r => r.Floor).ThenBy(r => r.RoomNumber).ToListAsync(ct);
        var bookings = await Occupancy.Overlapping(db, from, to).AsNoTracking()
            .OrderBy(b => b.CheckIn).ToListAsync(ct);
        var blocks = await Occupancy.OverlappingBlocks(db, from, to).AsNoTracking().ToListAsync(ct);

        return Result.Success(new TapeChartDto(from, days,
            rooms.Select(r => new TapeRoomDto(r.Id, r.RoomNumber, r.RoomType, r.RoomTypeId, r.Floor, r.Status, r.HousekeepingStatus)).ToList(),
            bookings.Select(b => new TapeBookingDto(b.Id, b.RoomId, b.BookingNumber, b.GuestName, b.CheckIn, b.CheckOut,
                b.Status, b.Balance, b.Adults, b.Children, b.Source)).ToList(),
            blocks.Select(SetupMappings.ToDto).ToList()));
    }
}
