using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Abstractions;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Application.Training;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

// ── Trainers ────────────────────────────────────────────────────────────────

internal static class TrainerReader
{
    public static async Task<TrainerDto> ToDtoAsync(FitnessDbContext db, Trainer t, CancellationToken ct)
    {
        var today = Fx.Today(null);
        var branches = await Fx.BranchNamesAsync(db, ct);
        var clients = await db.PtPackages.Where(p => !p.IsDeleted && !p.IsCancelled && p.TrainerId == t.Id && p.UsedSessions < p.TotalSessions)
            .Select(p => p.MemberId).Distinct().CountAsync(ct);
        var upcoming = await db.PtSessions.CountAsync(s => s.TrainerId == t.Id && s.Status == PtSessionStatus.Scheduled && string.Compare(s.Date, today) >= 0, ct)
                     + await db.Sessions.CountAsync(s => !s.IsDeleted && s.TrainerId == t.Id && s.Status == SessionStatus.Scheduled && string.Compare(s.Date, today) >= 0, ct);
        return Map(t, t.BranchId is { } b ? branches.GetValueOrDefault(b) : null, clients, upcoming);
    }

    public static TrainerDto Map(Trainer t, string? branch, int clients, int upcoming) => new(t.Id, t.Name, t.Phone, t.Email,
        t.Specialties, t.Certifications, t.Bio, t.BranchId, branch, t.LinkedUserId, t.SessionRate, t.CommissionPct,
        t.PhotoData != null, t.IsActive, clients, upcoming);
}

internal sealed class GetTrainersHandler(FitnessDbContext db) : IQueryHandler<GetTrainersQuery, IReadOnlyList<TrainerDto>>
{
    public async Task<Result<IReadOnlyList<TrainerDto>>> Handle(GetTrainersQuery q, CancellationToken ct)
    {
        var trainers = db.Trainers.AsNoTracking().Where(t => !t.IsDeleted);
        if (q.ActiveOnly) trainers = trainers.Where(t => t.IsActive);
        var list = await trainers.OrderBy(t => t.Name).ToListAsync(ct);
        var today = Fx.Today(null);
        var branches = await Fx.BranchNamesAsync(db, ct);

        var clients = (await db.PtPackages.AsNoTracking().Where(p => !p.IsDeleted && !p.IsCancelled && p.UsedSessions < p.TotalSessions)
            .Select(p => new { p.TrainerId, p.MemberId }).Distinct().ToListAsync(ct)).GroupBy(x => x.TrainerId).ToDictionary(g => g.Key, g => g.Count());
        var pt = await db.PtSessions.AsNoTracking().Where(s => s.Status == PtSessionStatus.Scheduled && string.Compare(s.Date, today) >= 0)
            .GroupBy(s => s.TrainerId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var cls = await db.Sessions.AsNoTracking().Where(s => !s.IsDeleted && s.TrainerId != null && s.Status == SessionStatus.Scheduled && string.Compare(s.Date, today) >= 0)
            .GroupBy(s => s.TrainerId!.Value).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);

        return Result.Success<IReadOnlyList<TrainerDto>>(list.Select(t => TrainerReader.Map(t,
            t.BranchId is { } b ? branches.GetValueOrDefault(b) : null, clients.GetValueOrDefault(t.Id),
            pt.GetValueOrDefault(t.Id) + cls.GetValueOrDefault(t.Id))).ToList());
    }
}

internal sealed class GetTrainerPhotoHandler(FitnessDbContext db) : IQueryHandler<GetTrainerPhotoQuery, string?>
{
    public async Task<Result<string?>> Handle(GetTrainerPhotoQuery q, CancellationToken ct) =>
        Result.Success<string?>(await db.Trainers.AsNoTracking().Where(t => t.Id == q.Id && !t.IsDeleted).Select(t => t.PhotoData).FirstOrDefaultAsync(ct));
}

internal sealed class SaveTrainerHandler(FitnessDbContext db) : ICommandHandler<SaveTrainerCommand, TrainerDto>
{
    public async Task<Result<TrainerDto>> Handle(SaveTrainerCommand c, CancellationToken ct)
    {
        Trainer? t;
        if (c.Id is { } id)
        {
            t = await db.Trainers.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (t is null) return Result.Failure<TrainerDto>(Fx.NotFound("Trainer"));
        }
        else { t = new Trainer(c.Name); db.Trainers.Add(t); }
        t.Update(c.Name, c.Phone, c.Email, c.Specialties, c.Certifications, c.Bio, c.BranchId, c.LinkedUserId,
            c.SessionRate, c.CommissionPct, c.IsActive);
        if (!string.IsNullOrEmpty(c.PhotoData)) t.SetPhoto(c.PhotoData);
        await db.SaveChangesAsync(ct);
        return Result.Success(await TrainerReader.ToDtoAsync(db, t, ct));
    }
}

internal sealed class DeleteTrainerHandler(FitnessDbContext db) : ICommandHandler<DeleteTrainerCommand>
{
    public async Task<Result> Handle(DeleteTrainerCommand c, CancellationToken ct)
    {
        var t = await db.Trainers.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure(Fx.NotFound("Trainer"));
        var today = Fx.Today(null);
        if (await db.PtPackages.AnyAsync(p => !p.IsDeleted && !p.IsCancelled && p.TrainerId == t.Id && p.UsedSessions < p.TotalSessions, ct)
            || await db.PtSessions.AnyAsync(s => s.TrainerId == t.Id && s.Status == PtSessionStatus.Scheduled && string.Compare(s.Date, today) >= 0, ct))
            return Result.Failure(Fx.Conflict("Trainer", "This trainer still has clients or sessions booked. Switch them off instead."));
        t.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Personal-training packages ──────────────────────────────────────────────

internal static class PtReader
{
    public static string State(PtPackage p, string today) =>
        p.IsCancelled ? "cancelled"
        : p.UsedSessions >= p.TotalSessions ? "completed"
        : p.ExpiresOn != null && string.CompareOrdinal(today, p.ExpiresOn) > 0 ? "expired"
        : "active";

    public static async Task<List<PtPackageDto>> ToDtosAsync(FitnessDbContext db, IReadOnlyCollection<PtPackage> list, string today, CancellationToken ct)
    {
        var mIds = list.Select(p => p.MemberId).Distinct().ToList();
        var members = await db.Members.AsNoTracking().IgnoreQueryFilters().Where(m => mIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);
        var trainers = await db.Trainers.AsNoTracking().IgnoreQueryFilters().ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        return list.Select(p => new PtPackageDto(p.Id, p.MemberId, members.GetValueOrDefault(p.MemberId)?.FullName,
            members.GetValueOrDefault(p.MemberId)?.MemberNumber, p.TrainerId, trainers.GetValueOrDefault(p.TrainerId), p.Name,
            p.TotalSessions, p.UsedSessions, p.Remaining, p.Price, p.AmountPaid, p.Balance, p.StartDate, p.ExpiresOn,
            p.Notes, p.IsCancelled, State(p, today), p.CreatedAt)).ToList();
    }
}

internal sealed class GetPtPackagesHandler(FitnessDbContext db) : IQueryHandler<GetPtPackagesQuery, IReadOnlyList<PtPackageDto>>
{
    public async Task<Result<IReadOnlyList<PtPackageDto>>> Handle(GetPtPackagesQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var p = db.PtPackages.AsNoTracking().Where(x => !x.IsDeleted);
        if (q.MemberId is { } m) p = p.Where(x => x.MemberId == m);
        if (q.TrainerId is { } t) p = p.Where(x => x.TrainerId == t);
        var list = await p.OrderByDescending(x => x.CreatedAt).Take(1000).ToListAsync(ct);
        if (q.ActiveOnly) list = list.Where(x => PtReader.State(x, today) == "active").ToList();
        return Result.Success<IReadOnlyList<PtPackageDto>>(await PtReader.ToDtosAsync(db, list, today, ct));
    }
}

internal sealed class SellPtPackageHandler(FitnessDbContext db, ICurrentUser user) : ICommandHandler<SellPtPackageCommand, PtPackageDto>
{
    public async Task<Result<PtPackageDto>> Handle(SellPtPackageCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<PtPackageDto>(Fx.NotFound("Member"));
        if (member.Status == MemberStatus.Blacklisted) return Result.Failure<PtPackageDto>(Fx.Conflict("Member", "This member is blacklisted."));
        var trainer = await db.Trainers.FirstOrDefaultAsync(t => t.Id == c.TrainerId && !t.IsDeleted, ct);
        if (trainer is null) return Result.Failure<PtPackageDto>(Fx.NotFound("Trainer"));
        if (!trainer.IsActive) return Result.Failure<PtPackageDto>(Fx.Conflict("Trainer", "This trainer is switched off."));

        var price = c.Price ?? trainer.SessionRate * c.Sessions;
        if (c.AmountPaid > price) return Result.Failure<PtPackageDto>(Fx.Conflict("Package", "The amount paid is more than the price."));

        var pkg = new PtPackage(member.Id, trainer.Id, string.IsNullOrWhiteSpace(c.Name) ? $"{c.Sessions} PT sessions" : c.Name!,
            c.Sessions, price, Dates.Valid(c.StartDate) ? c.StartDate! : today, c.ExpiresOn, c.Notes);
        db.PtPackages.Add(pkg);
        if (c.AmountPaid > 0)
        {
            pkg.AddPayment(c.AmountPaid);
            db.Payments.Add(new FitnessPayment($"RCT-{await Fx.NextAsync(db, "receipt", ct):D6}", member.Id, null, pkg.Id,
                c.BranchId ?? member.HomeBranchId, c.AmountPaid, c.PaymentMethod!, today, c.PaymentReference, null, user.Id, user.Name));
        }
        await db.SaveChangesAsync(ct);
        return Result.Success((await PtReader.ToDtosAsync(db, [pkg], today, ct))[0]);
    }
}

internal sealed class CancelPtPackageHandler(FitnessDbContext db) : ICommandHandler<CancelPtPackageCommand, PtPackageDto>
{
    public async Task<Result<PtPackageDto>> Handle(CancelPtPackageCommand c, CancellationToken ct)
    {
        var p = await db.PtPackages.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure<PtPackageDto>(Fx.NotFound("Package"));
        if (p.IsCancelled) return Result.Failure<PtPackageDto>(Fx.Conflict("Package", "Already cancelled."));
        p.Cancel();
        // Sessions still on the diary go with it; ones already given stay as history.
        foreach (var s in await db.PtSessions.Where(s => s.PackageId == p.Id && s.Status == PtSessionStatus.Scheduled).ToListAsync(ct))
            s.Close(PtSessionStatus.Cancelled, "Package cancelled", false);
        await db.SaveChangesAsync(ct);
        return Result.Success((await PtReader.ToDtosAsync(db, [p], Fx.Today(null), ct))[0]);
    }
}

// ── Personal-training sessions ──────────────────────────────────────────────

internal static class PtSessionReader
{
    public static async Task<List<PtSessionDto>> ToDtosAsync(FitnessDbContext db, IReadOnlyCollection<PtSession> list, CancellationToken ct)
    {
        var mIds = list.Select(s => s.MemberId).Distinct().ToList();
        var pIds = list.Select(s => s.PackageId).Distinct().ToList();
        var members = await db.Members.AsNoTracking().IgnoreQueryFilters().Where(m => mIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.FirstName + (m.LastName == null ? "" : " " + m.LastName), ct);
        var pkgs = await db.PtPackages.AsNoTracking().IgnoreQueryFilters().Where(p => pIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct);
        var trainers = await db.Trainers.AsNoTracking().IgnoreQueryFilters().ToDictionaryAsync(t => t.Id, t => t.Name, ct);
        return list.OrderBy(s => s.Date).ThenBy(s => s.StartTime).Select(s => new PtSessionDto(s.Id, s.PackageId,
            pkgs.GetValueOrDefault(s.PackageId), s.MemberId, members.GetValueOrDefault(s.MemberId), s.TrainerId,
            trainers.GetValueOrDefault(s.TrainerId), s.BranchId, s.Date, s.StartTime, s.DurationMinutes, s.Status,
            s.Notes, s.SessionLog, s.Counted)).ToList();
    }

    /// <summary>True when the trainer already has a session overlapping this slot.</summary>
    public static async Task<bool> ClashesAsync(FitnessDbContext db, Guid trainerId, string date, string start, int minutes, Guid? ignore, CancellationToken ct)
    {
        var from = ClassRules.Mins(start);
        var to = from + minutes;
        var others = await db.PtSessions.AsNoTracking()
            .Where(s => s.TrainerId == trainerId && s.Date == date && s.Status == PtSessionStatus.Scheduled && s.Id != ignore).ToListAsync(ct);
        if (others.Any(s => ClassRules.Mins(s.StartTime) < to && from < ClassRules.Mins(s.StartTime) + s.DurationMinutes)) return true;
        var classes = await db.Sessions.AsNoTracking()
            .Where(s => !s.IsDeleted && s.TrainerId == trainerId && s.Date == date && s.Status == SessionStatus.Scheduled).ToListAsync(ct);
        return classes.Any(s => ClassRules.Mins(s.StartTime) < to && from < ClassRules.Mins(s.EndTime));
    }
}

internal sealed class GetPtSessionsHandler(FitnessDbContext db) : IQueryHandler<GetPtSessionsQuery, IReadOnlyList<PtSessionDto>>
{
    public async Task<Result<IReadOnlyList<PtSessionDto>>> Handle(GetPtSessionsQuery q, CancellationToken ct)
    {
        var s = db.PtSessions.AsNoTracking().AsQueryable();
        if (Dates.Valid(q.From)) s = s.Where(x => string.Compare(x.Date, q.From) >= 0);
        if (Dates.Valid(q.To)) s = s.Where(x => string.Compare(x.Date, q.To) <= 0);
        if (q.TrainerId is { } t) s = s.Where(x => x.TrainerId == t);
        if (q.MemberId is { } m) s = s.Where(x => x.MemberId == m);
        if (q.PackageId is { } p) s = s.Where(x => x.PackageId == p);
        return Result.Success<IReadOnlyList<PtSessionDto>>(await PtSessionReader.ToDtosAsync(db, await s.Take(1000).ToListAsync(ct), ct));
    }
}

internal sealed class BookPtSessionHandler(FitnessDbContext db) : ICommandHandler<BookPtSessionCommand, PtSessionDto>
{
    public async Task<Result<PtSessionDto>> Handle(BookPtSessionCommand c, CancellationToken ct)
    {
        var p = await db.PtPackages.FirstOrDefaultAsync(x => x.Id == c.PackageId && !x.IsDeleted, ct);
        if (p is null) return Result.Failure<PtSessionDto>(Fx.NotFound("Package"));
        if (PtReader.State(p, c.Date) != "active") return Result.Failure<PtSessionDto>(Fx.Conflict("Package", "This package is not active on that date."));

        // Sessions already on the diary count against the package so it cannot be over-booked.
        var pending = await db.PtSessions.CountAsync(s => s.PackageId == p.Id && s.Status == PtSessionStatus.Scheduled, ct);
        if (p.Remaining - pending <= 0) return Result.Failure<PtSessionDto>(Fx.Conflict("Package", "No sessions left on this package."));
        if (await PtSessionReader.ClashesAsync(db, p.TrainerId, c.Date, c.StartTime, c.DurationMinutes, null, ct))
            return Result.Failure<PtSessionDto>(Fx.Conflict("Session", "The trainer is busy at that time."));

        var s = new PtSession(p.Id, p.MemberId, p.TrainerId, c.BranchId, c.Date, c.StartTime, c.DurationMinutes, c.Notes);
        db.PtSessions.Add(s);
        await db.SaveChangesAsync(ct);
        return Result.Success((await PtSessionReader.ToDtosAsync(db, [s], ct))[0]);
    }
}

internal sealed class ReschedulePtSessionHandler(FitnessDbContext db) : ICommandHandler<ReschedulePtSessionCommand, PtSessionDto>
{
    public async Task<Result<PtSessionDto>> Handle(ReschedulePtSessionCommand c, CancellationToken ct)
    {
        var s = await db.PtSessions.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure<PtSessionDto>(Fx.NotFound("Session"));
        if (s.Status != PtSessionStatus.Scheduled) return Result.Failure<PtSessionDto>(Fx.Conflict("Session", "Only a scheduled session can move."));
        if (await PtSessionReader.ClashesAsync(db, s.TrainerId, c.Date, c.StartTime, c.DurationMinutes, s.Id, ct))
            return Result.Failure<PtSessionDto>(Fx.Conflict("Session", "The trainer is busy at that time."));
        s.Reschedule(c.Date, c.StartTime, c.DurationMinutes, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await PtSessionReader.ToDtosAsync(db, [s], ct))[0]);
    }
}

internal sealed class ClosePtSessionHandler(FitnessDbContext db) : ICommandHandler<ClosePtSessionCommand, PtSessionDto>
{
    public async Task<Result<PtSessionDto>> Handle(ClosePtSessionCommand c, CancellationToken ct)
    {
        var s = await db.PtSessions.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (s is null) return Result.Failure<PtSessionDto>(Fx.NotFound("Session"));
        if (s.Status != PtSessionStatus.Scheduled) return Result.Failure<PtSessionDto>(Fx.Conflict("Session", "This session is already closed."));
        if (c.Status is not (PtSessionStatus.Completed or PtSessionStatus.NoShow or PtSessionStatus.Cancelled))
            return Result.Failure<PtSessionDto>(Error.Custom("Validation.Failed", "Close as completed, no_show or cancelled."));

        // A session given, or missed without notice, uses one of the package's sessions; a cancellation does not.
        var counts = c.Status != PtSessionStatus.Cancelled;
        if (counts)
        {
            var pkg = await db.PtPackages.FirstOrDefaultAsync(p => p.Id == s.PackageId, ct);
            pkg?.UseSession();
        }
        s.Close(c.Status, c.SessionLog, counts);
        await db.SaveChangesAsync(ct);
        return Result.Success((await PtSessionReader.ToDtosAsync(db, [s], ct))[0]);
    }
}
