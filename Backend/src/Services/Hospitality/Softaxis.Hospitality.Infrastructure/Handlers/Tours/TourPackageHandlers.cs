using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Tours;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Handlers.Pms;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Tours;

internal sealed class GetTourPackagesHandler(HospitalityDbContext db) : IQueryHandler<GetTourPackagesQuery, IReadOnlyList<TourPackageDto>>
{
    public async Task<Result<IReadOnlyList<TourPackageDto>>> Handle(GetTourPackagesQuery q, CancellationToken ct)
    {
        var query = db.TourPackages.AsNoTracking().Include(p => p.Days).Where(p => !p.IsDeleted);
        if (!q.IncludeInactive) query = query.Where(p => p.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(p => p.Name.Contains(s) || p.Code.Contains(s) || (p.Destination != null && p.Destination.Contains(s)));
        }
        var list = await query.OrderBy(p => p.Name).ToListAsync(ct);
        var today = HotelDates.Today(null);
        var ids = list.Select(p => p.Id).ToList();
        var upcoming = await db.TourDepartures.AsNoTracking()
            .Where(d => ids.Contains(d.TourPackageId) && !d.IsDeleted && d.Status == "open" && string.Compare(d.StartDate, today) >= 0)
            .GroupBy(d => d.TourPackageId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return Result.Success<IReadOnlyList<TourPackageDto>>(list.Select(p => TourSupport.ToDto(p, upcoming.GetValueOrDefault(p.Id))).ToList());
    }
}

internal sealed class GetTourPackageByIdHandler(HospitalityDbContext db) : IQueryHandler<GetTourPackageByIdQuery, TourPackageDto>
{
    public async Task<Result<TourPackageDto>> Handle(GetTourPackageByIdQuery q, CancellationToken ct)
    {
        var p = await db.TourPackages.AsNoTracking().Include(x => x.Days).FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        return p is null ? Result.Failure<TourPackageDto>(Error.NotFoundById("TourPackage", q.Id)) : Result.Success(TourSupport.ToDto(p, 0));
    }
}

internal sealed class UpsertTourPackageHandler(HospitalityDbContext db) : ICommandHandler<UpsertTourPackageCommand, TourPackageDto>
{
    public async Task<Result<TourPackageDto>> Handle(UpsertTourPackageCommand cmd, CancellationToken ct)
    {
        var code = cmd.Code.Trim().ToUpperInvariant();
        if (await db.TourPackages.AnyAsync(p => !p.IsDeleted && p.Code == code && p.Id != cmd.Id, ct))
            return Result.Failure<TourPackageDto>(Error.Custom("TourPackage.Duplicate", $"A package with the code {code} already exists."));

        TourPackage p;
        if (cmd.Id is null)
        {
            p = new TourPackage(code, cmd.Name);
            db.TourPackages.Add(p);
        }
        else
        {
            var found = await db.TourPackages.Include(x => x.Days).FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
            if (found is null) return Result.Failure<TourPackageDto>(Error.NotFoundById("TourPackage", cmd.Id));
            p = found;
        }
        p.Update(code, cmd.Name, cmd.Destination, cmd.Category, cmd.DurationDays, cmd.Description, cmd.Inclusions,
            cmd.Exclusions, cmd.PricePerAdult, cmd.PricePerChild, cmd.SingleSupplement, cmd.IsActive);
        if (cmd.Days is not null)
        {
            // Replacing the itinerary: drop the old rows explicitly so EF deletes them.
            db.TourItineraryDays.RemoveRange(p.Days.ToList());
            p.SetItinerary(cmd.Days.Select(d => (d.Title, d.Description, d.Accommodation, d.Meals)));
            foreach (var d in p.Days) db.Entry(d).State = EntityState.Added;
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(TourSupport.ToDto(p, 0));
    }
}

internal sealed class DeleteTourPackageHandler(HospitalityDbContext db) : ICommandHandler<DeleteTourPackageCommand>
{
    public async Task<Result> Handle(DeleteTourPackageCommand cmd, CancellationToken ct)
    {
        var p = await db.TourPackages.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure(Error.NotFoundById("TourPackage", cmd.Id));
        var today = HotelDates.Today(null);
        var depIds = await db.TourDepartures.Where(d => d.TourPackageId == p.Id && !d.IsDeleted).Select(d => d.Id).ToListAsync(ct);
        if (await db.TourBookings.AnyAsync(b => !b.IsDeleted && b.Status != "cancelled" && string.Compare(b.EndDate, today) >= 0
                                               && (b.TourPackageId == p.Id || (b.DepartureId != null && depIds.Contains(b.DepartureId.Value))), ct))
            return Result.Failure(Error.Custom("TourPackage.Conflict",
                "This package has bookings for trips that have not finished. Switch it off instead, or cancel those bookings first."));
        p.Delete();
        foreach (var d in await db.TourDepartures.Where(d => d.TourPackageId == p.Id && !d.IsDeleted).ToListAsync(ct)) d.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Departures ───────────────────────────────────────────────────────────────

internal sealed class GetTourDeparturesHandler(HospitalityDbContext db) : IQueryHandler<GetTourDeparturesQuery, IReadOnlyList<TourDepartureDto>>
{
    public async Task<Result<IReadOnlyList<TourDepartureDto>>> Handle(GetTourDeparturesQuery q, CancellationToken ct)
    {
        var query = db.TourDepartures.AsNoTracking().Where(d => !d.IsDeleted);
        if (q.PackageId is not null) query = query.Where(d => d.TourPackageId == q.PackageId);
        if (!string.IsNullOrWhiteSpace(q.From)) query = query.Where(d => string.Compare(d.EndDate, q.From) >= 0);
        if (!string.IsNullOrWhiteSpace(q.To)) query = query.Where(d => string.Compare(d.StartDate, q.To) <= 0);
        if (!q.IncludeClosed) query = query.Where(d => d.Status == "open");
        var deps = await query.OrderBy(d => d.StartDate).Take(500).ToListAsync(ct);
        return Result.Success<IReadOnlyList<TourDepartureDto>>(await TourSupport.DeparturesAsync(db, deps, ct));
    }
}

internal sealed class UpsertTourDepartureHandler(HospitalityDbContext db) : ICommandHandler<UpsertTourDepartureCommand, TourDepartureDto>
{
    public async Task<Result<TourDepartureDto>> Handle(UpsertTourDepartureCommand cmd, CancellationToken ct)
    {
        var pkg = await db.TourPackages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == cmd.PackageId && !p.IsDeleted, ct);
        if (pkg is null) return Result.Failure<TourDepartureDto>(Error.NotFoundById("TourPackage", cmd.PackageId));
        var end = string.IsNullOrWhiteSpace(cmd.EndDate) ? TourSupport.EndFrom(cmd.StartDate, pkg.DurationDays) : cmd.EndDate!;

        TourDeparture dep;
        if (cmd.Id is null)
        {
            dep = new TourDeparture(pkg.Id, cmd.StartDate, end, cmd.Capacity, cmd.AdultPrice, cmd.ChildPrice, cmd.Notes);
            db.TourDepartures.Add(dep);
        }
        else
        {
            var found = await db.TourDepartures.FirstOrDefaultAsync(d => d.Id == cmd.Id && !d.IsDeleted, ct);
            if (found is null) return Result.Failure<TourDepartureDto>(Error.NotFoundById("TourDeparture", cmd.Id));
            dep = found;
            var taken = await TourSupport.SeatsTakenAsync(db, dep.Id, null, ct);
            if (cmd.Capacity < taken)
                return Result.Failure<TourDepartureDto>(Error.Custom("TourDeparture.Conflict",
                    $"{taken} seats are already booked; the departure cannot have fewer seats than that."));
            dep.Update(cmd.StartDate, end, cmd.Capacity, cmd.AdultPrice, cmd.ChildPrice, cmd.Notes);
            // Bookings on this departure travel on its dates.
            foreach (var b in await db.TourBookings.Where(b => b.DepartureId == dep.Id && !b.IsDeleted).ToListAsync(ct))
                b.SetDetails(b.Title, dep.StartDate, dep.EndDate, b.CustomerName, b.CustomerEmail, b.CustomerPhone, b.Source, b.Notes);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success((await TourSupport.DeparturesAsync(db, [dep], ct))[0]);
    }
}

internal sealed class SetTourDepartureStatusHandler(HospitalityDbContext db) : ICommandHandler<SetTourDepartureStatusCommand, TourDepartureDto>
{
    public async Task<Result<TourDepartureDto>> Handle(SetTourDepartureStatusCommand cmd, CancellationToken ct)
    {
        if (!TourDeparture.Statuses.Contains(cmd.Status))
            return Result.Failure<TourDepartureDto>(Error.Custom("Validation.Failed", "Unknown departure status."));
        var dep = await db.TourDepartures.FirstOrDefaultAsync(d => d.Id == cmd.Id && !d.IsDeleted, ct);
        if (dep is null) return Result.Failure<TourDepartureDto>(Error.NotFoundById("TourDeparture", cmd.Id));
        if (cmd.Status == "cancelled" && await db.TourBookings.AnyAsync(b => b.DepartureId == dep.Id && !b.IsDeleted && b.Status != "cancelled", ct))
            return Result.Failure<TourDepartureDto>(Error.Custom("TourDeparture.Conflict",
                "Cancel or move the bookings on this departure before cancelling it. Each customer needs their own refund decision."));
        dep.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);
        return Result.Success((await TourSupport.DeparturesAsync(db, [dep], ct))[0]);
    }
}

internal sealed class DeleteTourDepartureHandler(HospitalityDbContext db) : ICommandHandler<DeleteTourDepartureCommand>
{
    public async Task<Result> Handle(DeleteTourDepartureCommand cmd, CancellationToken ct)
    {
        var dep = await db.TourDepartures.FirstOrDefaultAsync(d => d.Id == cmd.Id && !d.IsDeleted, ct);
        if (dep is null) return Result.Failure(Error.NotFoundById("TourDeparture", cmd.Id));
        if (await db.TourBookings.AnyAsync(b => b.DepartureId == dep.Id && !b.IsDeleted, ct))
            return Result.Failure(Error.Custom("TourDeparture.Conflict", "This departure has bookings. Close or cancel it instead."));
        dep.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
