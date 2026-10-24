using Microsoft.EntityFrameworkCore;
using Softaxis.Hospitality.Application.Tours;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Tours;

internal static class TourSupport
{
    /// <summary>Seats held on a departure by bookings that are not cancelled.</summary>
    public static async Task<int> SeatsTakenAsync(HospitalityDbContext db, Guid departureId, Guid? excludeBookingId, CancellationToken ct) =>
        await db.TourBookings.Where(b => b.DepartureId == departureId && !b.IsDeleted && b.Status != "cancelled"
                                         && (excludeBookingId == null || b.Id != excludeBookingId))
            .SumAsync(b => (int?)(b.Adults + b.Children), ct) ?? 0;

    public static async Task<string?> CheckSeatsAsync(HospitalityDbContext db, TourDeparture dep, int pax, Guid? excludeBookingId, CancellationToken ct)
    {
        var taken = await SeatsTakenAsync(db, dep.Id, excludeBookingId, ct);
        var left = dep.Capacity - taken;
        return pax > left ? $"Only {Math.Max(0, left)} seat{(left == 1 ? "" : "s")} left on this departure ({pax} requested)." : null;
    }

    /// <summary>Re-reads services and payments and recomputes the booking's totals.</summary>
    public static async Task RecalculateAsync(HospitalityDbContext db, TourBooking booking, CancellationToken ct)
    {
        var services = await db.TourServices.Where(s => s.TourBookingId == booking.Id).ToListAsync(ct);
        // Include services added in this unit of work that are not saved yet.
        services.AddRange(db.ChangeTracker.Entries<TourService>()
            .Where(e => e.State == EntityState.Added && e.Entity.TourBookingId == booking.Id).Select(e => e.Entity)
            .Where(s => services.All(x => x.Id != s.Id)));
        services.RemoveAll(s => db.Entry(s).State == EntityState.Deleted);

        var payments = await db.TourPayments.Where(p => p.TourBookingId == booking.Id).ToListAsync(ct);
        payments.AddRange(db.ChangeTracker.Entries<TourPayment>()
            .Where(e => e.State == EntityState.Added && e.Entity.TourBookingId == booking.Id).Select(e => e.Entity)
            .Where(p => payments.All(x => x.Id != p.Id)));
        booking.Recalculate(services, payments.Where(p => !p.IsVoided).Sum(p => p.Amount));
    }

    /// <summary>
    /// Shares the money received across the schedule oldest-due first. With no schedule the whole
    /// balance is treated as due on the day the trip starts.
    /// </summary>
    public static IReadOnlyList<TourInstalmentDto> Allocate(TourBooking b, IEnumerable<TourInstalment> instalments, string today)
    {
        var list = instalments.OrderBy(i => i.DueDate, StringComparer.Ordinal).ThenBy(i => i.SortOrder).ToList();
        var rows = new List<TourInstalmentDto>();
        var pool = b.AmountPaid;
        foreach (var i in list)
        {
            var paid = Math.Min(pool, i.Amount);
            pool -= paid;
            var status = paid >= i.Amount - 0.005m ? "paid"
                : string.CompareOrdinal(i.DueDate, today) < 0 ? "overdue"
                : i.DueDate == today ? "due"
                : paid > 0 ? "partial" : "upcoming";
            rows.Add(new TourInstalmentDto(i.Id, i.Label, i.DueDate, i.Amount, paid, status));
        }
        return rows;
    }

    public static (string? NextDue, decimal Overdue) DueState(TourBooking b, IEnumerable<TourInstalment> instalments, string today)
    {
        if (b.Status == "cancelled" || b.Balance <= 0.005m) return (null, 0);
        var list = instalments.ToList();
        if (list.Count == 0)
            return (b.StartDate, string.CompareOrdinal(b.StartDate, today) < 0 ? b.Balance : 0);
        var rows = Allocate(b, list, today).Where(r => r.Status != "paid").ToList();
        var overdue = rows.Where(r => r.Status == "overdue").Sum(r => r.Amount - r.Paid);
        // Money still owed beyond the schedule (the schedule totals less than the price).
        var scheduled = list.Sum(i => i.Amount);
        if (b.TotalAmount - scheduled > 0.005m && string.CompareOrdinal(b.StartDate, today) < 0)
            overdue += Math.Min(b.Balance, b.TotalAmount - scheduled);
        return (rows.FirstOrDefault()?.DueDate ?? b.StartDate, Math.Min(overdue, b.Balance));
    }

    /// <summary>A passport must be valid six months beyond the return date for most destinations.</summary>
    public static bool PassportProblem(TourTraveller t, string tripEnd)
    {
        if (string.IsNullOrWhiteSpace(t.PassportNumber) || string.IsNullOrWhiteSpace(t.PassportExpiry)) return true;
        if (!HotelDates.TryParse(t.PassportExpiry, out var exp) || !HotelDates.TryParse(tripEnd, out var end)) return true;
        return exp < end.AddMonths(6);
    }

    public static TourBookingDto ToDto(TourBooking b, bool canSeeCosts, string? nextDue = null, decimal overdue = 0) => new(
        b.Id, b.BookingNumber, b.TourPackageId, b.DepartureId, b.Title, b.StartDate, b.EndDate, b.GuestId,
        b.CustomerName, b.CustomerEmail, b.CustomerPhone, b.Adults, b.Children, b.SingleRooms,
        b.AdultPrice, b.ChildPrice, b.SingleSupplement, b.PackageAmount, b.ExtrasAmount, b.DiscountAmount,
        b.TaxPercent, b.TaxAmount, b.TotalAmount, b.AmountPaid, b.Balance,
        canSeeCosts ? b.CostAmount : null, canSeeCosts ? b.Margin : null,
        b.Status, b.Source, b.CancelReason, b.Notes, b.CreatedByName, nextDue, overdue, b.CreatedAt);

    public static TourServiceDto ToDto(TourService s, bool canSeeCosts) => new(
        s.Id, s.Type, s.SupplierName, s.Description, s.ServiceDate, s.EndDate, s.ConfirmationNumber,
        canSeeCosts ? s.Cost : null, canSeeCosts ? s.SupplierPaid : null, canSeeCosts ? s.SupplierBalance : null,
        s.IsExtra, s.SellPrice, s.Status, s.Notes, s.Details);

    public static TourPaymentDto ToDto(TourPayment p) =>
        new(p.Id, p.Amount, p.Method, p.Reference, p.PaidOn, p.ReceivedBy, p.IsVoided, p.VoidReason, p.CreatedAt);

    public static ItineraryDayDto ToDto(TourItineraryDay d) => new(d.DayNumber, d.Title, d.Description, d.Accommodation, d.Meals);

    public static TourPackageDto ToDto(TourPackage p, int upcoming) => new(
        p.Id, p.Code, p.Name, p.Destination, p.Category, p.DurationDays, p.Description, p.Inclusions, p.Exclusions,
        p.PricePerAdult, p.PricePerChild, p.SingleSupplement, p.IsActive,
        p.Days.OrderBy(d => d.DayNumber).Select(ToDto).ToList(), upcoming, p.CreatedAt);

    /// <summary>Builds departure rows with seats and revenue for a set of departures in three queries.</summary>
    public static async Task<List<TourDepartureDto>> DeparturesAsync(HospitalityDbContext db, IReadOnlyList<TourDeparture> deps, CancellationToken ct)
    {
        if (deps.Count == 0) return [];
        var ids = deps.Select(d => d.Id).ToList();
        var pkgIds = deps.Select(d => d.TourPackageId).Distinct().ToList();
        var pkgs = await db.TourPackages.AsNoTracking().Where(p => pkgIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var stats = await db.TourBookings.AsNoTracking()
            .Where(b => b.DepartureId != null && ids.Contains(b.DepartureId.Value) && !b.IsDeleted && b.Status != "cancelled")
            .GroupBy(b => b.DepartureId!.Value)
            .Select(g => new { Id = g.Key, Seats = g.Sum(b => b.Adults + b.Children), Count = g.Count(), Revenue = g.Sum(b => b.TotalAmount) })
            .ToDictionaryAsync(x => x.Id, ct);
        return deps.Select(d =>
        {
            pkgs.TryGetValue(d.TourPackageId, out var p);
            stats.TryGetValue(d.Id, out var s);
            var seats = s?.Seats ?? 0;
            return new TourDepartureDto(d.Id, d.TourPackageId, p?.Code ?? "", p?.Name ?? "(deleted package)", p?.Destination,
                d.StartDate, d.EndDate, d.Capacity, seats, Math.Max(0, d.Capacity - seats),
                d.AdultPrice ?? p?.PricePerAdult ?? 0, d.ChildPrice ?? p?.PricePerChild ?? 0,
                d.AdultPrice is not null || d.ChildPrice is not null,
                d.Status, d.Notes, s?.Count ?? 0, s?.Revenue ?? 0);
        }).ToList();
    }

    /// <summary>Finds the returning customer by id, email or phone, or creates a profile.</summary>
    public static async Task<Guest?> ResolveGuestAsync(HospitalityDbContext db, Guid? guestId, string name, string? email, string? phone, CancellationToken ct)
    {
        if (guestId is not null)
            return await db.Guests.FirstOrDefaultAsync(g => g.Id == guestId && !g.IsDeleted, ct);
        var e = Guest.Norm(email);
        var ph = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        Guest? match = null;
        if (e is not null) match = await db.Guests.FirstOrDefaultAsync(g => !g.IsDeleted && g.Email == e, ct);
        if (match is null && ph is not null) match = await db.Guests.FirstOrDefaultAsync(g => !g.IsDeleted && g.Phone == ph, ct);
        if (match is not null) { match.FillGaps(e, ph, null); return match; }
        var guest = new Guest(name, e, ph, null);
        db.Guests.Add(guest);
        return guest;
    }

    public static string EndFrom(string start, int days) =>
        HotelDates.TryParse(start, out var s) ? HotelDates.Text(s.AddDays(Math.Max(1, days) - 1)) : start;
}
