using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Classes;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

internal static class ClassRules
{
    public static int Mins(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..]);
    public static string Hhmm(int minutes) => $"{Math.Clamp(minutes, 0, 1439) / 60:D2}:{Math.Clamp(minutes, 0, 1439) % 60:D2}";

    private static readonly string[] Live = [BookingStatus.Booked, BookingStatus.Waitlisted, BookingStatus.Attended];

    public static bool IsLive(string status) => Live.Contains(status);

    /// <summary>Local "now" from what the client sent, else UTC — gyms book by their own wall clock.</summary>
    public static DateTime Now(string? today, string? localTime)
    {
        if (Dates.Valid(today) && localTime is { Length: 5 } && localTime[2] == ':')
            return Fx.D(today!).ToDateTime(TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(Mins(localTime))));
        return DateTime.UtcNow;
    }

    /// <summary>The membership a class booking is paid from: running, covers classes, and has credits left.</summary>
    public static Subscription? PickSubscription(IEnumerable<Subscription> subs, string today, int cost)
    {
        var running = subs.Where(s => !s.IsDeleted && Fx.State(s, today) == "active"
                                      && s.Category != PlanCategory.Personal).ToList();
        return running.Where(s => s.ClassCredits is not null && (s.ClassCreditsLeft ?? 0) >= cost).OrderBy(s => s.EndDate).FirstOrDefault()
            ?? running.Where(s => s.ClassCredits is null && s.Category is PlanCategory.Classes or PlanCategory.Combo)
                      .OrderBy(s => s.EndDate).FirstOrDefault();
    }

    public static void Charge(Subscription s, int cost) { if (s.ClassCredits is not null) for (var i = 0; i < cost; i++) s.UseClassCredit(); }
    public static void Refund(Subscription s, int cost) { if (s.ClassCredits is not null) for (var i = 0; i < cost; i++) s.ReturnClassCredit(); }

    public static async Task<SessionDto> ToDtoAsync(FitnessDbContext db, ClassSession s, CancellationToken ct)
    {
        var list = await ToDtosAsync(db, [s], ct);
        return list[0];
    }

    public static async Task<List<SessionDto>> ToDtosAsync(FitnessDbContext db, IReadOnlyCollection<ClassSession> sessions, CancellationToken ct)
    {
        var ids = sessions.Select(s => s.Id).ToList();
        var counts = (await db.Bookings.AsNoTracking().Where(b => ids.Contains(b.SessionId))
            .GroupBy(b => new { b.SessionId, b.Status }).Select(g => new { g.Key.SessionId, g.Key.Status, N = g.Count() }).ToListAsync(ct))
            .ToLookup(x => x.SessionId);
        var branches = await Fx.BranchNamesAsync(db, ct);
        var trainers = await Fx.TrainerNamesAsync(db, ct);
        var colors = await db.ClassTypes.AsNoTracking().IgnoreQueryFilters().ToDictionaryAsync(t => t.Id, t => t.Color, ct);

        int N(Guid id, params string[] st) => counts[id].Where(x => st.Contains(x.Status)).Sum(x => x.N);
        return sessions.Select(s => new SessionDto(s.Id, s.ClassTypeId, s.ClassName, colors.GetValueOrDefault(s.ClassTypeId),
            s.BranchId, branches.GetValueOrDefault(s.BranchId), s.TrainerId,
            s.TrainerId is { } t ? trainers.GetValueOrDefault(t) : null, s.Date, s.StartTime, s.EndTime, s.Capacity,
            s.CreditCost, s.Room, s.Notes, s.Status, s.CancelReason, s.SeriesId,
            N(s.Id, BookingStatus.Booked, BookingStatus.Attended, BookingStatus.NoShow), N(s.Id, BookingStatus.Waitlisted),
            N(s.Id, BookingStatus.Attended))).OrderBy(s => s.Date).ThenBy(s => s.StartTime).ToList();
    }

    public static async Task<BookingDto> BookingDtoAsync(FitnessDbContext db, ClassBooking b, CancellationToken ct)
    {
        var m = await db.Members.AsNoTracking().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == b.MemberId, ct);
        var s = await db.Sessions.AsNoTracking().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == b.SessionId, ct);
        return new BookingDto(b.Id, b.SessionId, b.MemberId, m?.FullName ?? "", m?.MemberNumber ?? "", m?.Phone, b.Status,
            b.WaitlistPosition, b.CreditUsed, b.BookedAt, b.CancelledAt, s?.ClassName, s?.Date, s?.StartTime);
    }

    /// <summary>After a seat frees up, moves the longest-waiting member in — if they still have a credit.</summary>
    public static async Task PromoteWaitlistAsync(FitnessDbContext db, ClassSession session, string today, CancellationToken ct)
    {
        while (true)
        {
            var taken = await db.Bookings.CountAsync(b => b.SessionId == session.Id && b.Status == BookingStatus.Booked, ct);
            if (taken >= session.Capacity) return;
            var next = await db.Bookings.Where(b => b.SessionId == session.Id && b.Status == BookingStatus.Waitlisted)
                .OrderBy(b => b.WaitlistPosition).FirstOrDefaultAsync(ct);
            if (next is null) return;

            var subs = await db.Subscriptions.Where(s => s.MemberId == next.MemberId && !s.IsDeleted).ToListAsync(ct);
            var sub = PickSubscription(subs, today, session.CreditCost);
            if (sub is null) { next.Cancel(false); continue; }   // nothing to pay with: drop them from the queue
            Charge(sub, session.CreditCost);
            next.Promote();
            next.MarkCreditUsed(sub.ClassCredits is not null);
            next.SetSubscription(sub.Id);
        }
    }
}

// ── Class types ─────────────────────────────────────────────────────────────

internal sealed class GetClassTypesHandler(FitnessDbContext db) : IQueryHandler<GetClassTypesQuery, IReadOnlyList<ClassTypeDto>>
{
    public async Task<Result<IReadOnlyList<ClassTypeDto>>> Handle(GetClassTypesQuery q, CancellationToken ct)
    {
        var types = db.ClassTypes.AsNoTracking().Where(t => !t.IsDeleted);
        if (q.ActiveOnly) types = types.Where(t => t.IsActive);
        return Result.Success<IReadOnlyList<ClassTypeDto>>((await types.OrderBy(t => t.Name).ToListAsync(ct)).Select(Map).ToList());
    }

    public static ClassTypeDto Map(ClassType t) => new(t.Id, t.Name, t.Description, t.Level, t.DurationMinutes,
        t.Capacity, t.Color, t.CreditCost, t.DropInPrice, t.IsActive);
}

internal sealed class SaveClassTypeHandler(FitnessDbContext db) : ICommandHandler<SaveClassTypeCommand, ClassTypeDto>
{
    public async Task<Result<ClassTypeDto>> Handle(SaveClassTypeCommand c, CancellationToken ct)
    {
        var name = c.Name.Trim();
        if (await db.ClassTypes.AnyAsync(t => !t.IsDeleted && t.Name == name && t.Id != c.Id, ct))
            return Result.Failure<ClassTypeDto>(Error.Custom("Class.Duplicate", "A class with this name already exists."));
        ClassType? t;
        if (c.Id is { } id)
        {
            t = await db.ClassTypes.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (t is null) return Result.Failure<ClassTypeDto>(Fx.NotFound("Class"));
        }
        else { t = new ClassType(c.Name); db.ClassTypes.Add(t); }
        t.Update(c.Name, c.Description, c.Level, c.DurationMinutes, c.Capacity, c.Color, c.CreditCost, c.DropInPrice, c.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(GetClassTypesHandler.Map(t));
    }
}

internal sealed class DeleteClassTypeHandler(FitnessDbContext db) : ICommandHandler<DeleteClassTypeCommand>
{
    public async Task<Result> Handle(DeleteClassTypeCommand c, CancellationToken ct)
    {
        var t = await db.ClassTypes.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (t is null) return Result.Failure(Fx.NotFound("Class"));
        var today = Fx.Today(null);
        if (await db.Sessions.AnyAsync(s => !s.IsDeleted && s.ClassTypeId == t.Id && s.Status == SessionStatus.Scheduled
                                            && string.Compare(s.Date, today) >= 0, ct))
            return Result.Failure(Fx.Conflict("Class", "This class still has upcoming sessions. Cancel them first."));
        t.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Sessions ────────────────────────────────────────────────────────────────

internal sealed class GetSessionsHandler(FitnessDbContext db) : IQueryHandler<GetSessionsQuery, IReadOnlyList<SessionDto>>
{
    public async Task<Result<IReadOnlyList<SessionDto>>> Handle(GetSessionsQuery q, CancellationToken ct)
    {
        var s = db.Sessions.AsNoTracking().Where(x => !x.IsDeleted && string.Compare(x.Date, q.From) >= 0 && string.Compare(x.Date, q.To) <= 0);
        if (q.BranchId is { } b) s = s.Where(x => x.BranchId == b);
        if (q.TrainerId is { } t) s = s.Where(x => x.TrainerId == t);
        if (q.ClassTypeId is { } k) s = s.Where(x => x.ClassTypeId == k);
        if (!q.IncludeCancelled) s = s.Where(x => x.Status != SessionStatus.Cancelled);
        return Result.Success<IReadOnlyList<SessionDto>>(await ClassRules.ToDtosAsync(db, await s.Take(1000).ToListAsync(ct), ct));
    }
}

internal sealed class ScheduleClassHandler(FitnessDbContext db) : ICommandHandler<ScheduleClassCommand, IReadOnlyList<SessionDto>>
{
    public async Task<Result<IReadOnlyList<SessionDto>>> Handle(ScheduleClassCommand c, CancellationToken ct)
    {
        var type = await db.ClassTypes.FirstOrDefaultAsync(t => t.Id == c.ClassTypeId && !t.IsDeleted, ct);
        if (type is null) return Result.Failure<IReadOnlyList<SessionDto>>(Fx.NotFound("Class"));
        if (!type.IsActive) return Result.Failure<IReadOnlyList<SessionDto>>(Fx.Conflict("Class", "This class is switched off."));
        if (!await db.Branches.AnyAsync(b => b.Id == c.BranchId && !b.IsDeleted, ct))
            return Result.Failure<IReadOnlyList<SessionDto>>(Fx.NotFound("Branch"));
        if (c.TrainerId is { } tid && !await db.Trainers.AnyAsync(t => t.Id == tid && !t.IsDeleted, ct))
            return Result.Failure<IReadOnlyList<SessionDto>>(Fx.NotFound("Trainer"));

        var start = Fx.D(c.Date);
        var weekdays = c.Weekdays is { Count: > 0 } ? c.Weekdays.Distinct().ToList() : [(int)start.DayOfWeek];
        var dates = new List<DateOnly>();
        var weekStart = start.AddDays(-(int)start.DayOfWeek);
        for (var w = 0; w <= c.RepeatWeeks; w++)
            foreach (var d in weekdays)
            {
                var date = weekStart.AddDays(w * 7 + d);
                if (date >= start) dates.Add(date);
            }
        dates = dates.OrderBy(d => d).Take(200).ToList();
        if (dates.Count == 0) return Result.Failure<IReadOnlyList<SessionDto>>(Fx.Conflict("Class", "No dates to schedule."));

        var duration = c.DurationMinutes ?? type.DurationMinutes;
        var end = ClassRules.Hhmm(ClassRules.Mins(c.StartTime) + duration);
        var seriesId = dates.Count > 1 ? Guid.NewGuid() : (Guid?)null;
        var created = new List<ClassSession>();
        foreach (var d in dates)
        {
            var s = new ClassSession(type, c.BranchId, c.TrainerId, Fx.S(d), c.StartTime, end, c.Capacity ?? type.Capacity, c.Room);
            s.Update(c.TrainerId, Fx.S(d), c.StartTime, end, c.Capacity ?? type.Capacity, c.Room, c.Notes);
            if (seriesId is { } sid) s.SetSeries(sid);
            db.Sessions.Add(s);
            created.Add(s);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success<IReadOnlyList<SessionDto>>(await ClassRules.ToDtosAsync(db, created, ct));
    }
}

internal sealed class UpdateSessionHandler(FitnessDbContext db) : ICommandHandler<UpdateSessionCommand, SessionDto>
{
    public async Task<Result<SessionDto>> Handle(UpdateSessionCommand c, CancellationToken ct)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (s is null) return Result.Failure<SessionDto>(Fx.NotFound("Session"));
        if (s.Status != SessionStatus.Scheduled) return Result.Failure<SessionDto>(Fx.Conflict("Session", "Only a scheduled session can be changed."));

        var booked = await db.Bookings.CountAsync(b => b.SessionId == s.Id && b.Status == BookingStatus.Booked, ct);
        if (c.Capacity < booked) return Result.Failure<SessionDto>(Fx.Conflict("Session", $"{booked} members are already booked."));

        if (c.ApplyToSeries && s.SeriesId is { } series)
        {
            // Time, trainer, room and capacity move for the whole run from here on; dates stay put.
            var later = await db.Sessions.Where(x => x.SeriesId == series && !x.IsDeleted && x.Status == SessionStatus.Scheduled
                                                     && string.Compare(x.Date, s.Date) >= 0 && x.Id != s.Id).ToListAsync(ct);
            foreach (var x in later) x.Update(c.TrainerId, x.Date, c.StartTime, c.EndTime, Math.Max(c.Capacity, 1), c.Room, c.Notes);
        }
        s.Update(c.TrainerId, c.Date, c.StartTime, c.EndTime, c.Capacity, c.Room, c.Notes);
        await db.SaveChangesAsync(ct);
        await ClassRules.PromoteWaitlistAsync(db, s, Fx.Today(null), ct);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ClassRules.ToDtoAsync(db, s, ct));
    }
}

internal sealed class CancelSessionHandler(FitnessDbContext db) : ICommandHandler<CancelSessionCommand, int>
{
    public async Task<Result<int>> Handle(CancelSessionCommand c, CancellationToken ct)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (s is null) return Result.Failure<int>(Fx.NotFound("Session"));

        var targets = new List<ClassSession> { s };
        if (c.CancelSeries && s.SeriesId is { } series)
            targets.AddRange(await db.Sessions.Where(x => x.SeriesId == series && !x.IsDeleted && x.Id != s.Id
                && x.Status == SessionStatus.Scheduled && string.Compare(x.Date, s.Date) > 0).ToListAsync(ct));
        targets = targets.Where(x => x.Status == SessionStatus.Scheduled).ToList();
        if (targets.Count == 0) return Result.Failure<int>(Fx.Conflict("Session", "Nothing to cancel."));

        foreach (var t in targets)
        {
            // The gym cancelled, so everyone gets their credit back regardless of timing.
            var bookings = await db.Bookings.Where(b => b.SessionId == t.Id && (b.Status == BookingStatus.Booked || b.Status == BookingStatus.Waitlisted)).ToListAsync(ct);
            foreach (var b in bookings)
            {
                if (b.CreditUsed && b.SubscriptionId is { } sid)
                {
                    var sub = await db.Subscriptions.FirstOrDefaultAsync(x => x.Id == sid, ct);
                    if (sub is not null) ClassRules.Refund(sub, t.CreditCost);
                }
                b.Cancel(false);
            }
            t.Cancel(c.Reason);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(targets.Count);
    }
}

internal sealed class CompleteSessionHandler(FitnessDbContext db) : ICommandHandler<CompleteSessionCommand, SessionDto>
{
    public async Task<Result<SessionDto>> Handle(CompleteSessionCommand c, CancellationToken ct)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (s is null) return Result.Failure<SessionDto>(Fx.NotFound("Session"));
        if (s.Status != SessionStatus.Scheduled) return Result.Failure<SessionDto>(Fx.Conflict("Session", "This session is already closed."));

        var settings = await Fx.SettingsAsync(db, ct);
        foreach (var b in await db.Bookings.Where(b => b.SessionId == s.Id).ToListAsync(ct))
        {
            if (b.Status == BookingStatus.Waitlisted) b.Cancel(false);
            else if (b.Status == BookingStatus.Booked)
            {
                if (c.MarkUnattendedAsNoShow)
                {
                    b.NoShow();
                    if (!settings.ChargeCreditForNoShow && b.CreditUsed && b.SubscriptionId is { } sid)
                    {
                        var sub = await db.Subscriptions.FirstOrDefaultAsync(x => x.Id == sid, ct);
                        if (sub is not null) ClassRules.Refund(sub, s.CreditCost);
                    }
                }
                else b.Attend();
            }
        }
        s.Complete();
        await db.SaveChangesAsync(ct);
        return Result.Success(await ClassRules.ToDtoAsync(db, s, ct));
    }
}

internal sealed class DeleteSessionHandler(FitnessDbContext db) : ICommandHandler<DeleteSessionCommand>
{
    public async Task<Result> Handle(DeleteSessionCommand c, CancellationToken ct)
    {
        var s = await db.Sessions.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (s is null) return Result.Failure(Fx.NotFound("Session"));
        if (await db.Bookings.AnyAsync(b => b.SessionId == s.Id && (b.Status == BookingStatus.Booked || b.Status == BookingStatus.Attended), ct))
            return Result.Failure(Fx.Conflict("Session", "Members are booked. Cancel the session instead so they get their credits back."));
        s.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Bookings ────────────────────────────────────────────────────────────────

internal sealed class GetBookingsHandler(FitnessDbContext db) : IQueryHandler<GetBookingsQuery, IReadOnlyList<BookingDto>>
{
    public async Task<Result<IReadOnlyList<BookingDto>>> Handle(GetBookingsQuery q, CancellationToken ct)
    {
        var b = db.Bookings.AsNoTracking().AsQueryable();
        if (q.SessionId is { } sid) b = b.Where(x => x.SessionId == sid);
        if (q.MemberId is { } mid) b = b.Where(x => x.MemberId == mid);
        if (q.UpcomingOnly)
        {
            var today = Fx.Today(q.Today);
            b = b.Where(x => db.Sessions.Any(s => s.Id == x.SessionId && string.Compare(s.Date, today) >= 0));
        }
        var rows = await b.OrderBy(x => x.Status == BookingStatus.Waitlisted).ThenBy(x => x.WaitlistPosition).ThenBy(x => x.BookedAt).Take(1000).ToListAsync(ct);
        var result = new List<BookingDto>();
        foreach (var r in rows) result.Add(await ClassRules.BookingDtoAsync(db, r, ct));
        return Result.Success<IReadOnlyList<BookingDto>>(result);
    }
}

internal sealed class BookClassHandler(FitnessDbContext db) : ICommandHandler<BookClassCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(BookClassCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var settings = await Fx.SettingsAsync(db, ct);
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == c.SessionId && !s.IsDeleted, ct);
        if (session is null) return Result.Failure<BookingDto>(Fx.NotFound("Session"));
        if (session.Status != SessionStatus.Scheduled) return Result.Failure<BookingDto>(Fx.Conflict("Session", "This session is not open for booking."));
        if (string.CompareOrdinal(session.Date, today) < 0) return Result.Failure<BookingDto>(Fx.Conflict("Session", "This session has passed."));
        if (string.CompareOrdinal(session.Date, Fx.Add(today, settings.BookingWindowDays)) > 0)
            return Result.Failure<BookingDto>(Fx.Conflict("Session", $"Bookings open {settings.BookingWindowDays} days ahead."));

        var member = await db.Members.FirstOrDefaultAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct);
        if (member is null) return Result.Failure<BookingDto>(Fx.NotFound("Member"));
        if (member.Status != MemberStatus.Active) return Result.Failure<BookingDto>(Fx.Conflict("Member", "This member is not active."));

        var existing = await db.Bookings.FirstOrDefaultAsync(b => b.SessionId == session.Id && b.MemberId == member.Id, ct);
        if (existing is not null)
        {
            if (ClassRules.IsLive(existing.Status)) return Result.Failure<BookingDto>(Fx.Conflict("Booking", "Already booked for this class."));
            if (existing.Status == BookingStatus.LateCancel) return Result.Failure<BookingDto>(Fx.Conflict("Booking", "This booking was cancelled late and cannot be reopened."));
            db.Bookings.Remove(existing);   // a plain cancellation leaves nothing to keep
            await db.SaveChangesAsync(ct);
        }

        var subs = await db.Subscriptions.Where(s => s.MemberId == member.Id && !s.IsDeleted).ToListAsync(ct);
        var sub = ClassRules.PickSubscription(subs, today, session.CreditCost);
        if (sub is null)
            return Result.Failure<BookingDto>(Fx.Conflict("Booking", "This member has no running membership with class credits left."));

        var taken = await db.Bookings.CountAsync(b => b.SessionId == session.Id && b.Status == BookingStatus.Booked, ct);
        bool wait = taken >= session.Capacity;
        if (wait && !c.AllowWaitlist) return Result.Failure<BookingDto>(Fx.Conflict("Booking", "This class is full."));

        int position = 0;
        if (wait)
            position = (await db.Bookings.Where(b => b.SessionId == session.Id && b.Status == BookingStatus.Waitlisted)
                .MaxAsync(b => (int?)b.WaitlistPosition, ct) ?? 0) + 1;

        var booking = new ClassBooking(session.Id, member.Id, sub.Id, wait, position);
        if (!wait) { ClassRules.Charge(sub, session.CreditCost); booking.MarkCreditUsed(sub.ClassCredits is not null); }
        db.Bookings.Add(booking);
        await db.SaveChangesAsync(ct);
        return Result.Success(await ClassRules.BookingDtoAsync(db, booking, ct));
    }
}

internal sealed class CancelBookingHandler(FitnessDbContext db) : ICommandHandler<CancelBookingCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(CancelBookingCommand c, CancellationToken ct)
    {
        var b = await db.Bookings.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure<BookingDto>(Fx.NotFound("Booking"));
        if (b.Status is not (BookingStatus.Booked or BookingStatus.Waitlisted))
            return Result.Failure<BookingDto>(Fx.Conflict("Booking", "This booking can no longer be cancelled."));

        var session = await db.Sessions.FirstAsync(s => s.Id == b.SessionId, ct);
        var settings = await Fx.SettingsAsync(db, ct);
        var wasBooked = b.Status == BookingStatus.Booked;

        var starts = Fx.D(session.Date).ToDateTime(TimeOnly.FromTimeSpan(TimeSpan.FromMinutes(ClassRules.Mins(session.StartTime))));
        var late = wasBooked && (starts - ClassRules.Now(c.Today, c.LocalTime)).TotalHours < settings.LateCancelHours;

        // Cancelling in time returns the credit; cancelling inside the cut-off keeps it spent.
        if (wasBooked && !late && b.CreditUsed && b.SubscriptionId is { } sid)
        {
            var sub = await db.Subscriptions.FirstOrDefaultAsync(x => x.Id == sid, ct);
            if (sub is not null) ClassRules.Refund(sub, session.CreditCost);
        }
        b.Cancel(late);
        await db.SaveChangesAsync(ct);
        if (wasBooked) { await ClassRules.PromoteWaitlistAsync(db, session, Fx.Today(c.Today), ct); await db.SaveChangesAsync(ct); }
        return Result.Success(await ClassRules.BookingDtoAsync(db, b, ct));
    }
}

internal sealed class MarkAttendanceHandler(FitnessDbContext db) : ICommandHandler<MarkAttendanceCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(MarkAttendanceCommand c, CancellationToken ct)
    {
        var b = await db.Bookings.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (b is null) return Result.Failure<BookingDto>(Fx.NotFound("Booking"));
        if (b.Status is not (BookingStatus.Booked or BookingStatus.Attended or BookingStatus.NoShow))
            return Result.Failure<BookingDto>(Fx.Conflict("Booking", "Only a confirmed booking can be marked."));
        if (c.Status is not (BookingStatus.Attended or BookingStatus.NoShow))
            return Result.Failure<BookingDto>(Error.Custom("Validation.Failed", "Mark attended or no_show."));

        var session = await db.Sessions.FirstAsync(s => s.Id == b.SessionId, ct);
        var settings = await Fx.SettingsAsync(db, ct);
        var sub = b.SubscriptionId is { } sid ? await db.Subscriptions.FirstOrDefaultAsync(x => x.Id == sid, ct) : null;

        // Moving between attended and no-show only changes the credit if the gym refunds no-shows.
        if (sub is not null && b.CreditUsed && !settings.ChargeCreditForNoShow)
        {
            if (c.Status == BookingStatus.NoShow && b.Status != BookingStatus.NoShow) ClassRules.Refund(sub, session.CreditCost);
            if (c.Status == BookingStatus.Attended && b.Status == BookingStatus.NoShow) ClassRules.Charge(sub, session.CreditCost);
        }
        if (c.Status == BookingStatus.Attended) b.Attend(); else b.NoShow();
        await db.SaveChangesAsync(ct);
        return Result.Success(await ClassRules.BookingDtoAsync(db, b, ct));
    }
}
