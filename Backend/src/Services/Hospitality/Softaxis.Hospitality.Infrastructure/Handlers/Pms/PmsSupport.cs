using Microsoft.EntityFrameworkCore;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Pms;

/// <summary>Calendar-day helpers. A stay runs from the arrival night up to, not including, the departure day.</summary>
internal static class HotelDates
{
    private const string Format = "yyyy-MM-dd";

    public static bool TryParse(string? s, out DateOnly d) =>
        DateOnly.TryParseExact(s, Format, out d);

    public static string Text(DateOnly d) => d.ToString(Format);

    /// <summary>
    /// "Today" as the desk sees it. The server clock is UTC, so a hotel east of Greenwich is
    /// already on tomorrow for a few hours each night — the client's date is used when it is
    /// within a day of the server's, and ignored otherwise.
    /// </summary>
    public static string Today(string? clientToday)
    {
        var utc = DateOnly.FromDateTime(DateTime.UtcNow);
        return TryParse(clientToday, out var d) && Math.Abs(d.DayNumber - utc.DayNumber) <= 1 ? Text(d) : Text(utc);
    }

    public static IReadOnlyList<DateOnly> Nights(string checkIn, string checkOut)
    {
        if (!TryParse(checkIn, out var a) || !TryParse(checkOut, out var b) || b <= a) return [];
        var list = new List<DateOnly>(b.DayNumber - a.DayNumber);
        for (var d = a; d < b; d = d.AddDays(1)) list.Add(d);
        return list;
    }
}

/// <summary>
/// Work a hotel needs before its first booking, done the first time it is needed — never at
/// startup, where there is no tenant and rows would be written that no workspace can see.
/// </summary>
internal static class PmsBootstrap
{
    public static async Task<HotelSettings> SettingsAsync(HospitalityDbContext db, CancellationToken ct)
    {
        var s = await db.HotelSettings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = HotelSettings.CreateDefault();
        db.HotelSettings.Add(s);
        await db.SaveChangesAsync(ct);
        return s;
    }

    /// <summary>
    /// Rooms created before room types existed carry their type as text. Each distinct text becomes
    /// a room type (base rate = the cheapest such room) and the rooms are linked to it, so prices
    /// and availability work by type from the first use.
    /// </summary>
    public static async Task EnsureRoomTypesAsync(HospitalityDbContext db, CancellationToken ct)
    {
        var unlinked = await db.Rooms.Where(r => !r.IsDeleted && r.RoomTypeId == null).ToListAsync(ct);
        if (unlinked.Count == 0) return;

        var types = await db.RoomTypes.Where(t => !t.IsDeleted).ToListAsync(ct);
        foreach (var group in unlinked.GroupBy(r => (r.RoomType ?? "Standard").Trim(), StringComparer.OrdinalIgnoreCase))
        {
            var type = types.FirstOrDefault(t =>
                string.Equals(t.Name, group.Key, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t.Code, CodeFor(group.Key), StringComparison.OrdinalIgnoreCase));
            if (type is null)
            {
                var code = CodeFor(group.Key);
                var n = 2;
                while (types.Any(t => t.Code == code)) code = $"{CodeFor(group.Key)}{n++}";
                type = new RoomType(code, Title(group.Key), group.Min(r => r.RatePerNight),
                    Math.Max(1, group.Max(r => r.Capacity)), 0, null, null);
                db.RoomTypes.Add(type);
                types.Add(type);
            }
            foreach (var room in group) room.LinkType(type.Id);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>A hotel always has one plan to sell from: "Best Available Rate", room only.</summary>
    public static async Task<RatePlan> DefaultPlanAsync(HospitalityDbContext db, CancellationToken ct)
    {
        var plans = await db.RatePlans.Where(p => !p.IsDeleted).ToListAsync(ct);
        var plan = plans.FirstOrDefault(p => p.IsDefault) ?? plans.FirstOrDefault(p => p.IsActive);
        if (plan is not null)
        {
            if (!plan.IsDefault) { plan.SetDefault(true); await db.SaveChangesAsync(ct); }
            return plan;
        }
        plan = new RatePlan("BAR", "Best Available Rate", "room_only", true, "The standard rate, room only.");
        plan.SetDefault(true);
        db.RatePlans.Add(plan);
        await db.SaveChangesAsync(ct);
        return plan;
    }

    private static string CodeFor(string name)
    {
        var letters = new string(name.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return letters.Length == 0 ? "STD" : letters[..Math.Min(6, letters.Length)];
    }

    private static string Title(string s) =>
        string.Join(' ', s.Replace('_', ' ').Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(w => char.ToUpperInvariant(w[0]) + w[1..]));
}

internal sealed record PricedNight(DateOnly Date, decimal Rate, bool IsWeekend, string? Season, int MinNights);

/// <summary>
/// Prices nights. For each night: the season of the chosen plan and room type that covers it (the
/// latest-starting one where seasons overlap), at its weekend rate on a weekend night; otherwise the
/// room's own rate when it has one; otherwise the room type's base rate.
/// </summary>
internal static class Pricing
{
    public static async Task<IReadOnlyList<PricedNight>> PriceAsync(
        HospitalityDbContext db, HotelSettings settings, Guid? ratePlanId, Guid? roomTypeId,
        decimal roomRate, decimal typeRate, IReadOnlyList<DateOnly> nights, CancellationToken ct)
    {
        if (nights.Count == 0) return [];
        var seasons = ratePlanId is null || roomTypeId is null
            ? []
            : await LoadSeasonsAsync(db, ratePlanId.Value, roomTypeId.Value, nights, ct);
        return Price(settings, seasons, roomRate, typeRate, nights);
    }

    public static async Task<List<SeasonalRate>> LoadSeasonsAsync(
        HospitalityDbContext db, Guid ratePlanId, Guid roomTypeId, IReadOnlyList<DateOnly> nights, CancellationToken ct)
    {
        var first = HotelDates.Text(nights[0]);
        var last = HotelDates.Text(nights[^1]);
        return await db.SeasonalRates.AsNoTracking()
            .Where(s => s.RatePlanId == ratePlanId && s.RoomTypeId == roomTypeId
                     && string.Compare(s.FromDate, last) <= 0 && string.Compare(s.ToDate, first) >= 0)
            .ToListAsync(ct);
    }

    public static IReadOnlyList<PricedNight> Price(HotelSettings settings, IReadOnlyCollection<SeasonalRate> seasons,
        decimal roomRate, decimal typeRate, IReadOnlyList<DateOnly> nights)
    {
        var fallback = roomRate > 0 ? roomRate : typeRate;
        var result = new List<PricedNight>(nights.Count);
        foreach (var night in nights)
        {
            var d = HotelDates.Text(night);
            var weekend = settings.IsWeekendNight(night);
            var season = seasons
                .Where(s => string.CompareOrdinal(s.FromDate, d) <= 0 && string.CompareOrdinal(s.ToDate, d) >= 0)
                .OrderByDescending(s => s.FromDate).ThenByDescending(s => s.CreatedAt)
                .FirstOrDefault();
            var rate = season is null ? fallback : (weekend ? season.WeekendRate ?? season.WeekdayRate : season.WeekdayRate);
            result.Add(new PricedNight(night, rate, weekend, season?.Label, season?.MinNights ?? 1));
        }
        return result;
    }

    /// <summary>The same arithmetic Booking.Recalculate uses, for a quote that is not yet a booking.</summary>
    public static (decimal Room, decimal Service, decimal Tax, decimal Fee, decimal Total) Totals(
        HotelSettings s, IReadOnlyList<PricedNight> nights, decimal extras = 0, decimal discount = 0)
    {
        var room = nights.Sum(n => n.Rate);
        var sub = Math.Max(0, room + extras - discount);
        var service = Math.Round(sub * s.ServiceChargePercent / 100m, 2);
        var tax = Math.Round((sub + service) * s.TaxPercent / 100m, 2);
        var fee = Math.Round(s.NightlyFee * nights.Count, 2);
        return (room, service, tax, fee, sub + service + tax + fee);
    }

    public static NightRateDto ToDto(PricedNight n) => new(HotelDates.Text(n.Date), n.Rate, n.IsWeekend, n.Season);
}

/// <summary>Who is in a room on which nights. One rule, used by search, booking, amending and moving.</summary>
internal static class Occupancy
{
    public static readonly string[] Holding = ["confirmed", "checked_in"];

    /// <summary>Stays overlapping [checkIn, checkOut) that hold a room. String compare works for yyyy-MM-dd.</summary>
    public static IQueryable<Booking> Overlapping(HospitalityDbContext db, string checkIn, string checkOut) =>
        db.Bookings.Where(b => !b.IsDeleted && Holding.Contains(b.Status)
            && string.Compare(b.CheckIn, checkOut) < 0 && string.Compare(b.CheckOut, checkIn) > 0);

    public static IQueryable<RoomBlock> OverlappingBlocks(HospitalityDbContext db, string from, string to) =>
        db.RoomBlocks.Where(b => string.Compare(b.FromDate, to) < 0 && string.Compare(b.ToDate, from) > 0);

    /// <summary>Why a room cannot be sold for those nights, or null when it can.</summary>
    public static async Task<string?> WhyUnavailableAsync(
        HospitalityDbContext db, Room room, string checkIn, string checkOut, Guid? ignoreBookingId, CancellationToken ct)
    {
        if (room.Status == "maintenance") return $"Room {room.RoomNumber} is out of service.";

        var clash = await Overlapping(db, checkIn, checkOut)
            .Where(b => b.RoomId == room.Id && (ignoreBookingId == null || b.Id != ignoreBookingId))
            .OrderBy(b => b.CheckIn)
            .Select(b => new { b.BookingNumber, b.GuestName, b.CheckIn, b.CheckOut })
            .FirstOrDefaultAsync(ct);
        if (clash is not null)
            return $"Room {room.RoomNumber} is taken by {clash.GuestName} ({clash.BookingNumber}) from {clash.CheckIn} to {clash.CheckOut}.";

        var block = await OverlappingBlocks(db, checkIn, checkOut).Where(b => b.RoomId == room.Id)
            .Select(b => new { b.Reason, b.FromDate, b.ToDate }).FirstOrDefaultAsync(ct);
        return block is null ? null
            : $"Room {room.RoomNumber} is out of order from {block.FromDate} to {block.ToDate} ({block.Reason}).";
    }
}

/// <summary>Keeps a booking's money in step with its nights and folio.</summary>
internal static class Folio
{
    /// <summary>
    /// The priced nights of a stay. A booking taken before the PMS has none: its nights are written
    /// now at the rate it was sold at, so later changes start from what the guest was quoted.
    /// </summary>
    public static async Task<List<BookingNight>> NightsAsync(HospitalityDbContext db, Booking b, CancellationToken ct)
    {
        var nights = await db.BookingNights.Where(n => n.BookingId == b.Id).OrderBy(n => n.Date).ToListAsync(ct);
        if (nights.Count > 0) return nights;

        foreach (var d in HotelDates.Nights(b.CheckIn, b.CheckOut))
        {
            var n = new BookingNight(b.Id, HotelDates.Text(d), b.RatePerNight);
            db.BookingNights.Add(n);
            nights.Add(n);
        }
        return nights;
    }

    public static async Task RecalculateAsync(HospitalityDbContext db, Booking b, IReadOnlyCollection<BookingNight> nights, CancellationToken ct)
    {
        var extras = await db.FolioCharges.Where(c => c.BookingId == b.Id && !c.IsVoided).SumAsync(c => (decimal?)c.Amount, ct) ?? 0m;
        // Charges added in this unit of work are not in the database yet.
        extras += db.ChangeTracker.Entries<FolioCharge>()
            .Where(e => e.State == EntityState.Added && e.Entity.BookingId == b.Id && !e.Entity.IsVoided)
            .Sum(e => e.Entity.Amount);
        b.Recalculate(nights, extras);
    }

    /// <summary>Replaces a stay's nights with freshly priced ones, keeping the price of any night already booked.</summary>
    public static async Task<List<BookingNight>> RepriceAsync(
        HospitalityDbContext db, Booking b, HotelSettings settings, Room room, RoomType? type,
        string checkIn, string checkOut, bool keepExistingPrices, CancellationToken ct)
    {
        var old = await NightsAsync(db, b, ct);
        var wanted = HotelDates.Nights(checkIn, checkOut);
        var priced = await Pricing.PriceAsync(db, settings, b.RatePlanId, room.RoomTypeId ?? type?.Id,
            room.RatePerNight, type?.BaseRate ?? 0, wanted, ct);

        var keep = keepExistingPrices ? old.ToDictionary(n => n.Date) : new Dictionary<string, BookingNight>();
        db.BookingNights.RemoveRange(old.Where(n => !keepExistingPrices || !wanted.Contains(DateOnly.ParseExact(n.Date, "yyyy-MM-dd"))));

        var result = new List<BookingNight>();
        foreach (var p in priced)
        {
            var date = HotelDates.Text(p.Date);
            if (keep.TryGetValue(date, out var existing)) { result.Add(existing); continue; }
            var n = new BookingNight(b.Id, date, p.Rate);
            db.BookingNights.Add(n);
            result.Add(n);
        }
        return result;
    }
}
