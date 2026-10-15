using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Tours;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Tours;

internal sealed class GetTourBookingsHandler(HospitalityDbContext db) : IQueryHandler<GetTourBookingsQuery, PagedResult<TourBookingDto>>
{
    public async Task<Result<PagedResult<TourBookingDto>>> Handle(GetTourBookingsQuery q, CancellationToken ct)
    {
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 200);
        var query = db.TourBookings.AsNoTracking().Where(b => !b.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Status))
            query = q.Status == "open" ? query.Where(b => b.Status == "enquiry" || b.Status == "confirmed") : query.Where(b => b.Status == q.Status);
        if (q.DepartureId is not null) query = query.Where(b => b.DepartureId == q.DepartureId);
        if (q.GuestId is not null) query = query.Where(b => b.GuestId == q.GuestId);
        if (!string.IsNullOrWhiteSpace(q.From)) query = query.Where(b => string.Compare(b.EndDate, q.From) >= 0);
        if (!string.IsNullOrWhiteSpace(q.To)) query = query.Where(b => string.Compare(b.StartDate, q.To) <= 0);
        if (q.BalanceOnly) query = query.Where(b => b.Status != "cancelled" && b.TotalAmount - b.AmountPaid > 0.005m);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(b => b.CustomerName.Contains(s) || b.BookingNumber.Contains(s) || b.Title.Contains(s)
                                  || (b.CustomerPhone != null && b.CustomerPhone.Contains(s)) || (b.CustomerEmail != null && b.CustomerEmail.Contains(s)));
        }
        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(b => b.Status == "cancelled" || b.Status == "completed")
            .ThenBy(b => b.StartDate).ThenBy(b => b.Id).Skip((page - 1) * size).Take(size).ToListAsync(ct);

        var today = HotelDates.Today(q.Today);
        var ids = rows.Select(r => r.Id).ToList();
        var inst = (await db.TourInstalments.AsNoTracking().Where(i => ids.Contains(i.TourBookingId)).ToListAsync(ct))
            .ToLookup(i => i.TourBookingId);
        var items = rows.Select(b =>
        {
            var (next, overdue) = TourSupport.DueState(b, inst[b.Id], today);
            return TourSupport.ToDto(b, q.CanSeeCosts, next, overdue);
        }).ToList();
        return Result.Success(PagedResult<TourBookingDto>.Create(items, total, page, size));
    }
}

internal sealed class GetTourBookingByIdHandler(HospitalityDbContext db) : IQueryHandler<GetTourBookingByIdQuery, TourBookingDetailDto>
{
    public async Task<Result<TourBookingDetailDto>> Handle(GetTourBookingByIdQuery q, CancellationToken ct)
    {
        var b = await db.TourBookings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<TourBookingDetailDto>(Error.NotFoundById("TourBooking", q.Id));
        return Result.Success(await TourDetail.BuildAsync(db, b, q.CanSeeCosts, HotelDates.Today(q.Today), ct));
    }
}

internal static class TourDetail
{
    public static async Task<TourBookingDetailDto> BuildAsync(HospitalityDbContext db, TourBooking b, bool canSeeCosts, string today, CancellationToken ct)
    {
        TourPackage? pkg = null;
        var pkgId = b.TourPackageId;
        if (pkgId is null && b.DepartureId is not null)
            pkgId = await db.TourDepartures.Where(d => d.Id == b.DepartureId).Select(d => (Guid?)d.TourPackageId).FirstOrDefaultAsync(ct);
        if (pkgId is not null)
            pkg = await db.TourPackages.AsNoTracking().Include(p => p.Days).FirstOrDefaultAsync(p => p.Id == pkgId, ct);

        var travellers = await db.TourTravellers.AsNoTracking().Where(t => t.TourBookingId == b.Id).OrderBy(t => t.SortOrder).ToListAsync(ct);
        var services = await db.TourServices.AsNoTracking().Where(s => s.TourBookingId == b.Id)
            .OrderBy(s => s.ServiceDate ?? "9999").ThenBy(s => s.CreatedAt).ToListAsync(ct);
        var inst = await db.TourInstalments.AsNoTracking().Where(i => i.TourBookingId == b.Id).ToListAsync(ct);
        var payments = await db.TourPayments.AsNoTracking().Where(p => p.TourBookingId == b.Id).OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        var (next, overdue) = TourSupport.DueState(b, inst, today);

        return new TourBookingDetailDto(
            TourSupport.ToDto(b, canSeeCosts, next, overdue),
            pkg?.Name, pkg?.Destination, pkg?.Inclusions, pkg?.Exclusions,
            pkg?.Days.OrderBy(d => d.DayNumber).Select(TourSupport.ToDto).ToList() ?? [],
            travellers.Select(t => new TourTravellerDto(t.Id, t.FullName, t.Type, t.Gender, t.DateOfBirth, t.Nationality,
                t.PassportNumber, t.PassportExpiry, t.Notes, TourSupport.PassportProblem(t, b.EndDate))).ToList(),
            services.Select(s => TourSupport.ToDto(s, canSeeCosts)).ToList(),
            TourSupport.Allocate(b, inst, today),
            payments.Select(TourSupport.ToDto).ToList(),
            canSeeCosts);
    }
}

internal sealed class CreateTourBookingHandler(HospitalityDbContext db) : ICommandHandler<CreateTourBookingCommand, TourBookingDto>
{
    public async Task<Result<TourBookingDto>> Handle(CreateTourBookingCommand cmd, CancellationToken ct)
    {
        TourDeparture? dep = null;
        TourPackage? pkg = null;
        if (cmd.DepartureId is not null)
        {
            dep = await db.TourDepartures.FirstOrDefaultAsync(d => d.Id == cmd.DepartureId && !d.IsDeleted, ct);
            if (dep is null) return Result.Failure<TourBookingDto>(Error.NotFoundById("TourDeparture", cmd.DepartureId.Value));
            if (dep.Status != "open")
                return Result.Failure<TourBookingDto>(Error.Custom("TourBooking.Conflict", $"This departure is {dep.Status} and is not taking bookings."));
            var seats = await TourSupport.CheckSeatsAsync(db, dep, cmd.Adults + cmd.Children, null, ct);
            if (seats is not null) return Result.Failure<TourBookingDto>(Error.Custom("TourBooking.Conflict", seats));
            pkg = await db.TourPackages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == dep.TourPackageId, ct);
        }
        else if (cmd.PackageId is not null)
        {
            pkg = await db.TourPackages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == cmd.PackageId && !p.IsDeleted, ct);
            if (pkg is null) return Result.Failure<TourBookingDto>(Error.NotFoundById("TourPackage", cmd.PackageId.Value));
        }

        var start = dep?.StartDate ?? cmd.StartDate!;
        var end = dep?.EndDate ?? (string.IsNullOrWhiteSpace(cmd.EndDate) && pkg is not null ? TourSupport.EndFrom(start, pkg.DurationDays) : cmd.EndDate!);
        var title = !string.IsNullOrWhiteSpace(cmd.Title) ? cmd.Title! : pkg?.Name ?? "Tailor-made trip";

        var guest = await TourSupport.ResolveGuestAsync(db, cmd.GuestId, cmd.CustomerName, cmd.CustomerEmail, cmd.CustomerPhone, ct);
        if (guest is null && cmd.GuestId is not null) return Result.Failure<TourBookingDto>(Error.NotFoundById("Guest", cmd.GuestId.Value));

        var b = new TourBooking(title, start, end, cmd.CustomerName);
        b.SetDetails(title, start, end, cmd.CustomerName, cmd.CustomerEmail ?? guest?.Email, cmd.CustomerPhone ?? guest?.Phone, cmd.Source, cmd.Notes);
        b.LinkPackage(pkg?.Id, dep?.Id);
        b.LinkGuest(guest?.Id);
        b.SetCreatedBy(cmd.CreatedByName);
        b.SetPricing(cmd.Adults, cmd.Children, cmd.SingleRooms,
            cmd.AdultPrice ?? dep?.AdultPrice ?? pkg?.PricePerAdult ?? 0,
            cmd.ChildPrice ?? dep?.ChildPrice ?? pkg?.PricePerChild ?? 0,
            cmd.SingleSupplement ?? pkg?.SingleSupplement ?? 0,
            cmd.Discount, cmd.TaxPercent);
        if (cmd.Confirm) b.Confirm();
        b.Recalculate([], 0);
        db.TourBookings.Add(b);

        var n = 0;
        foreach (var t in cmd.Travellers ?? [])
            db.TourTravellers.Add(new TourTraveller(b.Id, t.FullName, t.Type, t.Gender, t.DateOfBirth, t.Nationality,
                t.PassportNumber, t.PassportExpiry, t.Notes, n++));

        await db.SaveChangesAsync(ct);
        return Result.Success(TourSupport.ToDto(b, false, b.StartDate, 0));
    }
}

internal sealed class UpdateTourBookingHandler(HospitalityDbContext db) : ICommandHandler<UpdateTourBookingCommand, TourBookingDto>
{
    public async Task<Result<TourBookingDto>> Handle(UpdateTourBookingCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<TourBookingDto>(Error.NotFoundById("TourBooking", cmd.Id));
        if (!b.IsOpen) return Result.Failure<TourBookingDto>(Error.Custom("TourBooking.Conflict", $"A {b.Status} booking cannot be edited."));

        var start = cmd.StartDate;
        var end = cmd.EndDate;
        if (b.DepartureId is not null)
        {
            var dep = await db.TourDepartures.FirstOrDefaultAsync(d => d.Id == b.DepartureId, ct);
            if (dep is not null)
            {
                // A seat on a scheduled departure travels on the departure's dates.
                start = dep.StartDate;
                end = dep.EndDate;
                var seats = await TourSupport.CheckSeatsAsync(db, dep, cmd.Adults + cmd.Children, b.Id, ct);
                if (seats is not null) return Result.Failure<TourBookingDto>(Error.Custom("TourBooking.Conflict", seats));
            }
        }
        b.SetDetails(cmd.Title, start, end, cmd.CustomerName, cmd.CustomerEmail, cmd.CustomerPhone, cmd.Source, cmd.Notes);
        b.SetPricing(cmd.Adults, cmd.Children, cmd.SingleRooms, cmd.AdultPrice, cmd.ChildPrice, cmd.SingleSupplement, cmd.Discount, cmd.TaxPercent);
        await TourSupport.RecalculateAsync(db, b, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(TourSupport.ToDto(b, false));
    }
}

internal sealed class SetTourBookingStatusHandler(HospitalityDbContext db) : ICommandHandler<SetTourBookingStatusCommand, TourBookingDto>
{
    public async Task<Result<TourBookingDto>> Handle(SetTourBookingStatusCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<TourBookingDto>(Error.NotFoundById("TourBooking", cmd.Id));
        Result<TourBookingDto> Refuse(string m) => Result.Failure<TourBookingDto>(Error.Custom("TourBooking.Conflict", m));

        switch (cmd.Action)
        {
            case "confirm":
                if (b.Status != "enquiry") return Refuse("Only an enquiry can be confirmed.");
                b.Confirm();
                break;
            case "complete":
                if (b.Status != "confirmed") return Refuse("Only a confirmed booking can be marked completed.");
                b.Complete();
                if (b.GuestId is not null)
                    (await db.Guests.FirstOrDefaultAsync(g => g.Id == b.GuestId, ct))?.RecordStay(b.TotalAmount, b.EndDate);
                break;
            case "reopen":
                if (b.Status != "cancelled") return Refuse("Only a cancelled booking can be reopened.");
                if (b.DepartureId is not null)
                {
                    var dep = await db.TourDepartures.FirstOrDefaultAsync(d => d.Id == b.DepartureId && !d.IsDeleted, ct);
                    if (dep is null || dep.Status != "open") return Refuse("Its departure is no longer open.");
                    var seats = await TourSupport.CheckSeatsAsync(db, dep, b.Adults + b.Children, b.Id, ct);
                    if (seats is not null) return Refuse(seats);
                }
                b.Reopen();
                break;
            case "cancel":
                if (!b.IsOpen) return Refuse($"A {b.Status} booking cannot be cancelled.");
                if (string.IsNullOrWhiteSpace(cmd.Reason)) return Result.Failure<TourBookingDto>(Error.Custom("Validation.Failed", "Give a reason for the cancellation."));
                b.Cancel(cmd.Reason);
                break;
            default:
                return Result.Failure<TourBookingDto>(Error.Custom("Validation.Failed", "Unknown action."));
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(TourSupport.ToDto(b, false));
    }
}

internal sealed class DeleteTourBookingHandler(HospitalityDbContext db) : ICommandHandler<DeleteTourBookingCommand>
{
    public async Task<Result> Handle(DeleteTourBookingCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Error.NotFoundById("TourBooking", cmd.Id));
        // Money taken stays on record: a booking with a live payment can only be cancelled.
        if (await db.TourPayments.AnyAsync(p => p.TourBookingId == b.Id && !p.IsVoided, ct))
            return Result.Failure(Error.Custom("TourBooking.Conflict", "This booking has payments recorded. Cancel it instead, or void the payments first."));
        b.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SaveTourTravellersHandler(HospitalityDbContext db) : ICommandHandler<SaveTourTravellersCommand>
{
    public async Task<Result> Handle(SaveTourTravellersCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.BookingId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Error.NotFoundById("TourBooking", cmd.BookingId));
        db.TourTravellers.RemoveRange(await db.TourTravellers.Where(t => t.TourBookingId == b.Id).ToListAsync(ct));
        var n = 0;
        foreach (var t in cmd.Travellers)
            db.TourTravellers.Add(new TourTraveller(b.Id, t.FullName, t.Type, t.Gender, t.DateOfBirth, t.Nationality,
                t.PassportNumber, t.PassportExpiry, t.Notes, n++));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class UpsertTourServiceHandler(HospitalityDbContext db) : ICommandHandler<UpsertTourServiceCommand, TourServiceDto>
{
    public async Task<Result<TourServiceDto>> Handle(UpsertTourServiceCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.BookingId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<TourServiceDto>(Error.NotFoundById("TourBooking", cmd.BookingId));
        if (b.Status == "cancelled" && cmd.Id is null)
            return Result.Failure<TourServiceDto>(Error.Custom("TourBooking.Conflict", "This booking is cancelled."));

        TourService s;
        if (cmd.Id is null)
        {
            s = new TourService(b.Id);
            db.TourServices.Add(s);
        }
        else
        {
            var found = await db.TourServices.FirstOrDefaultAsync(x => x.Id == cmd.Id && x.TourBookingId == b.Id, ct);
            if (found is null) return Result.Failure<TourServiceDto>(Error.NotFoundById("TourService", cmd.Id));
            s = found;
        }
        s.Update(cmd.Type, cmd.SupplierName, cmd.Description, cmd.ServiceDate, cmd.EndDate, cmd.ConfirmationNumber,
            cmd.Cost, cmd.SupplierPaid, cmd.IsExtra, cmd.SellPrice, cmd.Status, cmd.Notes);
        await TourSupport.RecalculateAsync(db, b, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(TourSupport.ToDto(s, true));
    }
}

internal sealed class DeleteTourServiceHandler(HospitalityDbContext db) : ICommandHandler<DeleteTourServiceCommand>
{
    public async Task<Result> Handle(DeleteTourServiceCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.BookingId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Error.NotFoundById("TourBooking", cmd.BookingId));
        var s = await db.TourServices.FirstOrDefaultAsync(x => x.Id == cmd.Id && x.TourBookingId == b.Id, ct);
        if (s is null) return Result.Failure(Error.NotFoundById("TourService", cmd.Id));
        if (s.SupplierPaid > 0)
            return Result.Failure(Error.Custom("TourService.Conflict", "The supplier has been paid for this service. Mark it cancelled instead of deleting it."));
        db.TourServices.Remove(s);
        await TourSupport.RecalculateAsync(db, b, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SaveTourInstalmentsHandler(HospitalityDbContext db) : ICommandHandler<SaveTourInstalmentsCommand>
{
    public async Task<Result> Handle(SaveTourInstalmentsCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.BookingId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Error.NotFoundById("TourBooking", cmd.BookingId));
        var sum = cmd.Instalments.Sum(i => i.Amount);
        if (sum > b.TotalAmount + 0.005m)
            return Result.Failure(Error.Custom("Validation.Failed",
                $"The instalments add up to {sum:N2}, more than the booking total of {b.TotalAmount:N2}."));
        db.TourInstalments.RemoveRange(await db.TourInstalments.Where(i => i.TourBookingId == b.Id).ToListAsync(ct));
        var n = 0;
        foreach (var i in cmd.Instalments)
            db.TourInstalments.Add(new TourInstalment(b.Id, i.Label, i.DueDate, i.Amount, n++));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class AddTourPaymentHandler(HospitalityDbContext db) : ICommandHandler<AddTourPaymentCommand, TourPaymentDto>
{
    public async Task<Result<TourPaymentDto>> Handle(AddTourPaymentCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.BookingId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<TourPaymentDto>(Error.NotFoundById("TourBooking", cmd.BookingId));
        if (b.Status == "cancelled")
            return Result.Failure<TourPaymentDto>(Error.Custom("TourBooking.Conflict", "This booking is cancelled. Reopen it before taking money."));
        if (cmd.Amount > b.Balance + 0.005m)
            return Result.Failure<TourPaymentDto>(Error.Custom("TourBooking.Conflict",
                $"Only {b.Balance:N2} is owed on this booking. Record the extra as a service first if the price has changed."));
        var p = new TourPayment(b.Id, cmd.Amount, cmd.Method, cmd.Reference,
            string.IsNullOrWhiteSpace(cmd.PaidOn) ? HotelDates.Today(null) : cmd.PaidOn!, cmd.ReceivedBy);
        db.TourPayments.Add(p);
        // Taking a deposit is what turns an enquiry into a confirmed booking.
        if (b.Status == "enquiry") b.Confirm();
        await TourSupport.RecalculateAsync(db, b, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(TourSupport.ToDto(p));
    }
}

internal sealed class VoidTourPaymentHandler(HospitalityDbContext db) : ICommandHandler<VoidTourPaymentCommand>
{
    public async Task<Result> Handle(VoidTourPaymentCommand cmd, CancellationToken ct)
    {
        var b = await db.TourBookings.FirstOrDefaultAsync(x => x.Id == cmd.BookingId && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Error.NotFoundById("TourBooking", cmd.BookingId));
        var p = await db.TourPayments.FirstOrDefaultAsync(x => x.Id == cmd.PaymentId && x.TourBookingId == b.Id, ct);
        if (p is null) return Result.Failure(Error.NotFoundById("TourPayment", cmd.PaymentId));
        if (p.IsVoided) return Result.Failure(Error.Custom("TourPayment.Conflict", "This payment is already voided."));
        if (string.IsNullOrWhiteSpace(cmd.Reason)) return Result.Failure(Error.Custom("Validation.Failed", "Give a reason for voiding the payment."));
        p.Void(cmd.Reason);
        await TourSupport.RecalculateAsync(db, b, ct);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetTourDashboardHandler(HospitalityDbContext db) : IQueryHandler<GetTourDashboardQuery, TourDashboardDto>
{
    public async Task<Result<TourDashboardDto>> Handle(GetTourDashboardQuery q, CancellationToken ct)
    {
        var today = HotelDates.Today(q.Today);
        HotelDates.TryParse(today, out var t);
        var in30 = HotelDates.Text(t.AddDays(30));
        var in60 = HotelDates.Text(t.AddDays(60));
        var monthStart = HotelDates.Text(new DateOnly(t.Year, t.Month, 1));

        var open = await db.TourBookings.AsNoTracking().Where(b => !b.IsDeleted && (b.Status == "enquiry" || b.Status == "confirmed")).ToListAsync(ct);
        var ids = open.Select(b => b.Id).ToList();
        var inst = (await db.TourInstalments.AsNoTracking().Where(i => ids.Contains(i.TourBookingId)).ToListAsync(ct)).ToLookup(i => i.TourBookingId);

        var attention = new List<TourAttentionDto>();
        decimal overdueTotal = 0;
        foreach (var b in open)
        {
            var (_, overdue) = TourSupport.DueState(b, inst[b.Id], today);
            overdueTotal += overdue;
            if (overdue > 0)
                attention.Add(new(b.Id, b.BookingNumber, b.CustomerName, b.Title, b.StartDate, "payment", "Payment overdue", overdue));
            if (b.Status == "enquiry" && string.CompareOrdinal(b.StartDate, in30) <= 0)
                attention.Add(new(b.Id, b.BookingNumber, b.CustomerName, b.Title, b.StartDate, "enquiry", "Enquiry not confirmed and the trip is soon", null));
        }

        // Travellers on trips in the next 60 days whose passports will not do.
        var soonIds = open.Where(b => b.Status == "confirmed" && string.CompareOrdinal(b.StartDate, today) >= 0
                                      && string.CompareOrdinal(b.StartDate, in60) <= 0).Select(b => b.Id).ToList();
        var travellers = await db.TourTravellers.AsNoTracking().Where(x => soonIds.Contains(x.TourBookingId)).ToListAsync(ct);
        var counts = await db.TourTravellers.AsNoTracking().Where(x => soonIds.Contains(x.TourBookingId))
            .GroupBy(x => x.TourBookingId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        foreach (var b in open.Where(b => soonIds.Contains(b.Id)))
        {
            var bad = travellers.Count(x => x.TourBookingId == b.Id && TourSupport.PassportProblem(x, b.EndDate));
            var missing = b.Adults + b.Children - counts.GetValueOrDefault(b.Id);
            if (missing > 0)
                attention.Add(new(b.Id, b.BookingNumber, b.CustomerName, b.Title, b.StartDate, "travellers", $"{missing} traveller name{(missing == 1 ? "" : "s")} missing", null));
            if (bad > 0)
                attention.Add(new(b.Id, b.BookingNumber, b.CustomerName, b.Title, b.StartDate, "passport",
                    $"{bad} passport{(bad == 1 ? "" : "s")} missing or expiring within 6 months of return", null));
        }

        var services = await db.TourServices.AsNoTracking().Where(s => ids.Contains(s.TourBookingId)).ToListAsync(ct);
        var notConfirmed = services.Where(s => s.Status is "pending" or "requested").ToList();
        foreach (var g in notConfirmed.GroupBy(s => s.TourBookingId))
        {
            var b = open.First(x => x.Id == g.Key);
            if (b.Status == "confirmed" && string.CompareOrdinal(b.StartDate, in30) <= 0)
                attention.Add(new(b.Id, b.BookingNumber, b.CustomerName, b.Title, b.StartDate, "supplier",
                    $"{g.Count()} supplier booking{(g.Count() == 1 ? "" : "s")} not confirmed", null));
        }

        var month = await db.TourBookings.AsNoTracking()
            .Where(b => !b.IsDeleted && b.Status != "cancelled" && string.Compare(b.StartDate, monthStart) >= 0
                        && string.Compare(b.StartDate, HotelDates.Text(new DateOnly(t.Year, t.Month, 1).AddMonths(1))) < 0)
            .Select(b => new { b.TotalAmount, b.TaxAmount, b.CostAmount }).ToListAsync(ct);

        var deps = await db.TourDepartures.AsNoTracking()
            .Where(d => !d.IsDeleted && d.Status == "open" && string.Compare(d.StartDate, today) >= 0 && string.Compare(d.StartDate, in60) <= 0)
            .OrderBy(d => d.StartDate).Take(12).ToListAsync(ct);

        return Result.Success(new TourDashboardDto(
            open.Count(b => b.Status == "enquiry"),
            open.Count(b => b.Status == "confirmed"),
            open.Count(b => b.Status == "confirmed" && string.CompareOrdinal(b.StartDate, today) <= 0 && string.CompareOrdinal(b.EndDate, today) >= 0),
            open.Count(b => b.Status == "confirmed" && string.CompareOrdinal(b.StartDate, today) > 0 && string.CompareOrdinal(b.StartDate, in30) <= 0),
            open.Sum(b => b.Balance),
            overdueTotal,
            q.CanSeeCosts ? services.Sum(s => s.SupplierBalance) : null,
            q.CanSeeCosts ? month.Sum(m => m.TotalAmount - m.TaxAmount - m.CostAmount) : null,
            month.Sum(m => m.TotalAmount),
            notConfirmed.Count,
            await TourSupport.DeparturesAsync(db, deps, ct),
            attention.OrderBy(a => a.StartDate, StringComparer.Ordinal).Take(50).ToList()));
    }
}
