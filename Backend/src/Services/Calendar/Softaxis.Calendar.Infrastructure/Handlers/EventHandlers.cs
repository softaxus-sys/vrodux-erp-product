using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Calendar.Application.Abstractions;
using Softaxis.Calendar.Application.Events.Commands;
using Softaxis.Calendar.Application.Events.Dtos;
using Softaxis.Calendar.Application.Events.Queries;
using Softaxis.Calendar.Domain.Entities;
using Softaxis.Calendar.Infrastructure.Persistence;
using Softaxis.Calendar.Infrastructure.Sync;

namespace Softaxis.Calendar.Infrastructure.Handlers;

internal static class EventMapping
{
    // EF returns DateTime with Kind=Unspecified, which serialises WITHOUT a trailing Z and is then
    // read by a browser as local time. Every value leaving here is UTC, so say so.
    private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);

    public static CalendarEventDto ToDto(CalendarEvent e, Guid? me) => new(
        e.Id, e.Title, e.Description, e.Location, Utc(e.StartUtc), Utc(e.EndUtc), e.IsAllDay, e.TimeZone, e.MeetUrl,
        e.Source, CanEdit: me is not null && e.OwnerUserId == me && e.IsOrganizer, e.OwnerName,
        e.Attendees.Select(a => new AttendeeDto(a.Email, a.Name, a.ResponseStatus)).ToList(),
        e.SyncStatus, e.SyncError);

    /// <summary>What the caller may see: events they own, plus those that name their email as a guest.
    /// <c>!IsDeleted</c> is applied by hand - the tenant filter replaces any entity-level one.</summary>
    public static IQueryable<CalendarEvent> Visible(CalendarDbContext db, Guid me, string? email) =>
        db.Events.Where(e => !e.IsDeleted &&
            (e.OwnerUserId == me || (email != null && e.Attendees.Any(a => a.Email == email))));

    public static Task<CalendarConnection?> ConnectionAsync(CalendarDbContext db, Guid userId, CancellationToken ct) =>
        db.Connections.FirstOrDefaultAsync(c => c.UserId == userId && !c.IsDeleted && c.Status != "disconnected", ct);
}

internal sealed class GetEventsHandler(CalendarDbContext db, ICurrentUser user)
    : IQueryHandler<GetEventsQuery, IReadOnlyList<CalendarEventDto>>
{
    public async Task<Result<IReadOnlyList<CalendarEventDto>>> Handle(GetEventsQuery q, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<IReadOnlyList<CalendarEventDto>>(Error.Custom("Auth.Unresolved", "Sign in again."));
        var from = DateTime.SpecifyKind(q.FromUtc, DateTimeKind.Utc);
        var to   = DateTime.SpecifyKind(q.ToUtc, DateTimeKind.Utc);
        if (to <= from || (to - from).TotalDays > 400)
            return Result.Failure<IReadOnlyList<CalendarEventDto>>(Error.Custom("Validation.Failed", "Ask for a window of up to 400 days."));

        var rows = await EventMapping.Visible(db, me, user.Email).AsNoTracking().Include(e => e.Attendees)
            .Where(e => e.StartUtc < to && e.EndUtc > from)
            .OrderBy(e => e.StartUtc).Take(2000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<CalendarEventDto>>(rows.Select(e => EventMapping.ToDto(e, me)).ToList());
    }
}

internal sealed class GetEventByIdHandler(CalendarDbContext db, ICurrentUser user) : IQueryHandler<GetEventByIdQuery, CalendarEventDto>
{
    public async Task<Result<CalendarEventDto>> Handle(GetEventByIdQuery q, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<CalendarEventDto>(Error.Custom("Auth.Unresolved", "Sign in again."));
        var e = await EventMapping.Visible(db, me, user.Email).AsNoTracking().Include(x => x.Attendees)
            .FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return e is null ? Result.Failure<CalendarEventDto>(Error.NotFoundById("CalendarEvent", q.Id))
                         : Result.Success(EventMapping.ToDto(e, me));
    }
}

internal sealed class CreateEventHandler(CalendarDbContext db, ICurrentUser user, GoogleCalendarSync sync)
    : ICommandHandler<CreateEventCommand, CalendarEventDto>
{
    public async Task<Result<CalendarEventDto>> Handle(CreateEventCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<CalendarEventDto>(Error.Custom("Auth.Unresolved", "Sign in again."));

        var conn = await EventMapping.ConnectionAsync(db, me, ct);
        // A Meet link is Google's to create. Failing here, before anything is saved, beats saving an
        // event the user believes has a video link when it has none.
        if (c.AddMeet && conn is null)
            return Result.Failure<CalendarEventDto>(Error.Custom("Calendar.Conflict",
                "Connect your Google account to add a Google Meet link."));

        var ev = new CalendarEvent(me, user.Username, c.Title.Trim(), Norm(c.StartUtc), Norm(c.EndUtc), c.IsAllDay,
            string.IsNullOrWhiteSpace(c.TimeZone) ? null : c.TimeZone, EventSources.Vrodux);
        ev.SetDetails(Clip(c.Description, 4000), Clip(c.Location, 300));
        ev.ReplaceAttendees((c.Attendees ?? []).Select(a => (a.Email, a.Name, (string?)null)));
        db.Events.Add(ev);
        await db.SaveChangesAsync(ct);

        if (conn is not null)
        {
            await sync.PushAsync(ev, conn, c.AddMeet, ct);
            await db.SaveChangesAsync(ct);
        }
        return Result.Success(EventMapping.ToDto(ev, me));
    }

    private static DateTime Norm(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
    private static string? Clip(string? s, int max) => string.IsNullOrWhiteSpace(s) ? null : s.Trim().Length > max ? s.Trim()[..max] : s.Trim();
}

internal sealed class UpdateEventHandler(CalendarDbContext db, ICurrentUser user, GoogleCalendarSync sync)
    : ICommandHandler<UpdateEventCommand, CalendarEventDto>
{
    public async Task<Result<CalendarEventDto>> Handle(UpdateEventCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<CalendarEventDto>(Error.Custom("Auth.Unresolved", "Sign in again."));

        var ev = await db.Events.Include(e => e.Attendees).FirstOrDefaultAsync(e => e.Id == c.Id && !e.IsDeleted, ct);
        // An event you only have a view of (someone else's invitation) reads as "not found" for edits.
        if (ev is null || ev.OwnerUserId != me) return Result.Failure<CalendarEventDto>(Error.NotFoundById("CalendarEvent", c.Id));
        if (!ev.IsOrganizer)
            return Result.Failure<CalendarEventDto>(Error.Custom("Calendar.Conflict", "Only the organiser can change this event."));

        var conn = await EventMapping.ConnectionAsync(db, me, ct);
        if (c.AddMeet && conn is null)
            return Result.Failure<CalendarEventDto>(Error.Custom("Calendar.Conflict", "Connect your Google account to add a Google Meet link."));

        ev.Update(c.Title.Trim(), Clip(c.Description, 4000), Clip(c.Location, 300),
            DateTime.SpecifyKind(c.StartUtc, DateTimeKind.Utc), DateTime.SpecifyKind(c.EndUtc, DateTimeKind.Utc),
            c.IsAllDay, string.IsNullOrWhiteSpace(c.TimeZone) ? null : c.TimeZone);
        ev.ReplaceAttendees((c.Attendees ?? []).Select(a => (a.Email, a.Name, (string?)null)));
        await db.SaveChangesAsync(ct);

        if (conn is not null)
        {
            await sync.PushAsync(ev, conn, c.AddMeet, ct);
            await db.SaveChangesAsync(ct);
        }
        return Result.Success(EventMapping.ToDto(ev, me));
    }

    private static string? Clip(string? s, int max) => string.IsNullOrWhiteSpace(s) ? null : s.Trim().Length > max ? s.Trim()[..max] : s.Trim();
}

internal sealed class DeleteEventHandler(CalendarDbContext db, ICurrentUser user, GoogleCalendarSync sync) : ICommandHandler<DeleteEventCommand>
{
    public async Task<Result> Handle(DeleteEventCommand c, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure(Error.Custom("Auth.Unresolved", "Sign in again."));

        var ev = await db.Events.FirstOrDefaultAsync(e => e.Id == c.Id && !e.IsDeleted, ct);
        if (ev is null || ev.OwnerUserId != me) return Result.Failure(Error.NotFoundById("CalendarEvent", c.Id));
        if (!ev.IsOrganizer)
            return Result.Failure(Error.Custom("Calendar.Conflict", "Only the organiser can delete this event."));

        var conn = await EventMapping.ConnectionAsync(db, me, ct);
        if (conn is not null) await sync.PushDeleteAsync(ev, conn, ct);

        ev.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
