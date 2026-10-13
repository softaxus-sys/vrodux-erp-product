using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Calendar.Application.Abstractions;
using Softaxis.Calendar.Application.Events.Dtos;
using Softaxis.Calendar.Domain.Entities;
using Softaxis.Calendar.Infrastructure.Google;
using Softaxis.Calendar.Infrastructure.Persistence;

namespace Softaxis.Calendar.Infrastructure.Sync;

/// <summary>
/// The two-way bridge to Google. Push is best-effort and never fails the user's save (the event is
/// stored here first, and a failure is recorded on the row so it can be retried); pull is incremental
/// via Google's sync token, so a routine pass costs one small request.
/// </summary>
public sealed class GoogleCalendarSync(
    CalendarDbContext db, GoogleCalendarClient google, ISecretProtector protector, ILogger<GoogleCalendarSync> logger)
{
    // ── Tokens ──────────────────────────────────────────────────────────────────────────────

    /// <summary>A usable access token, refreshing (and re-saving) it when it is about to lapse.</summary>
    public async Task<string> AccessTokenAsync(CalendarConnection conn, CancellationToken ct)
    {
        if (conn.Credentials is null)
            throw new GoogleApiException(System.Net.HttpStatusCode.Unauthorized, "Google Calendar is not connected.") { NeedsReconnect = true };

        var creds = JsonSerializer.Deserialize<JsonElement>(protector.Unprotect(conn.Credentials)!);
        var access = creds.GetProperty("accessToken").GetString()!;
        var expires = creds.GetProperty("expiresAt").GetDateTime();
        if (expires > DateTime.UtcNow.AddMinutes(2)) return access;

        var refreshToken = creds.TryGetProperty("refreshToken", out var rt) ? rt.GetString() : null;
        if (string.IsNullOrEmpty(refreshToken))
            throw new GoogleApiException(System.Net.HttpStatusCode.Unauthorized, "Google access expired. Reconnect your Google account.") { NeedsReconnect = true };

        var fresh = await google.RefreshAsync(refreshToken, ct);
        conn.SetCredentials(protector.Protect(JsonSerializer.Serialize(new
        {
            accessToken = fresh.AccessToken, refreshToken = fresh.RefreshToken ?? refreshToken, expiresAt = fresh.ExpiresAt,
        }))!);
        await db.SaveChangesAsync(ct);
        return fresh.AccessToken;
    }

    // ── Push (Vrodux -> Google) ─────────────────────────────────────────────────────────────

    /// <summary>Creates or updates the event on Google. Never throws: a failure is recorded on the row.</summary>
    public async Task PushAsync(CalendarEvent ev, CalendarConnection conn, bool addMeet, CancellationToken ct)
    {
        try
        {
            var token = await AccessTokenAsync(conn, ct);
            var wantMeet = addMeet && string.IsNullOrEmpty(ev.MeetUrl);
            var body = BuildBody(ev, wantMeet);

            var result = ev.GoogleEventId is null
                ? await google.InsertAsync(token, body, wantMeet, ct)
                : await google.PatchAsync(token, ev.GoogleEventId, body, wantMeet, ct);

            ev.LinkGoogle(result.GetProperty("id").GetString()!, Str(result, "etag"));
            if (Str(result, "hangoutLink") is { Length: > 0 } meet) ev.SetMeetUrl(meet);
        }
        catch (GoogleApiException ex)
        {
            logger.LogWarning("Calendar push failed for event {Event}: {Message}", ev.Id, ex.Message);
            ev.RecordSyncError(ex.Message);
            if (ex.NeedsReconnect) conn.RecordError(ex.Message);
        }
        catch (HttpRequestException ex)
        {
            ev.RecordSyncError("Could not reach Google. It will be retried on the next sync.");
            logger.LogWarning(ex, "Calendar push could not reach Google for event {Event}.", ev.Id);
        }
    }

    public async Task PushDeleteAsync(CalendarEvent ev, CalendarConnection conn, CancellationToken ct)
    {
        if (ev.GoogleEventId is null) return;
        try { await google.DeleteAsync(await AccessTokenAsync(conn, ct), ev.GoogleEventId, ct); }
        catch (Exception ex) when (ex is GoogleApiException or HttpRequestException)
        {
            // The local delete still goes ahead; the row is kept as deleted so a later pull cannot revive it.
            logger.LogWarning("Calendar delete could not reach Google for event {Event}: {Message}", ev.Id, ex.Message);
        }
    }

    /// <summary>Upcoming events created before the user connected (or while Google was unreachable).</summary>
    public async Task<int> PushUnsyncedAsync(CalendarConnection conn, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow;
        var pending = await db.Events.Include(e => e.Attendees)
            .Where(e => !e.IsDeleted && e.OwnerUserId == conn.UserId && e.IsOrganizer
                        && e.GoogleEventId == null && e.EndUtc >= cutoff)
            .Take(200).ToListAsync(ct);
        foreach (var ev in pending) await PushAsync(ev, conn, addMeet: false, ct);
        await db.SaveChangesAsync(ct);
        return pending.Count;
    }

    // ── Pull (Google -> Vrodux) ─────────────────────────────────────────────────────────────

    public async Task<SyncResultDto> PullAsync(CalendarConnection conn, CancellationToken ct)
    {
        int created = 0, updated = 0, removed = 0;
        try
        {
            var token = await AccessTokenAsync(conn, ct);
            if (conn.AccountEmail is null)
                conn.SetAccount(await google.GetAccountEmailAsync(token, ct));

            GoogleCalendarClient.ListResult list;
            try { list = await google.ListAsync(token, conn.SyncToken, DateTime.UtcNow.AddDays(-30), ct); }
            catch (GoogleApiException ex) when (ex.Gone)
            {
                // The cursor went stale: start over from the window. Upserts keep this safe.
                list = await google.ListAsync(token, null, DateTime.UtcNow.AddDays(-30), ct);
            }

            var ids = list.Items.Select(i => Str(i, "id")).Where(i => i is not null).Select(i => i!).ToList();
            var existing = ids.Count == 0
                ? new Dictionary<string, CalendarEvent>()
                : (await db.Events.Include(e => e.Attendees)
                        .Where(e => e.OwnerUserId == conn.UserId && e.GoogleEventId != null && ids.Contains(e.GoogleEventId!))
                        .ToListAsync(ct))
                    .GroupBy(e => e.GoogleEventId!).ToDictionary(g => g.Key, g => g.First());

            foreach (var item in list.Items)
            {
                var id = Str(item, "id");
                if (id is null) continue;
                existing.TryGetValue(id, out var ev);

                if (Str(item, "status") == "cancelled")
                {
                    if (ev is { IsDeleted: false }) { ev.Delete(); removed++; }
                    continue;
                }
                if (ev is { IsDeleted: true }) continue; // deleted here: never resurrect it

                var parsed = Parse(item);
                if (parsed is null) continue;

                var etag = Str(item, "etag");
                if (ev is not null && etag is not null && ev.GoogleEtag == etag) continue; // our own echo / no change

                if (ev is null)
                {
                    ev = new CalendarEvent(conn.UserId, null, parsed.Title, parsed.Start, parsed.End,
                        parsed.AllDay, parsed.TimeZone, EventSources.Google);
                    db.Events.Add(ev);
                    created++;
                }
                else updated++;

                ev.Update(parsed.Title, parsed.Description, parsed.Location, parsed.Start, parsed.End, parsed.AllDay, parsed.TimeZone);
                ev.SetOrganizer(parsed.IsOrganizer);
                ev.SetMeetUrl(parsed.MeetUrl);
                ev.ReplaceAttendees(parsed.Attendees);
                ev.LinkGoogle(id, etag);
            }

            conn.SetSyncToken(list.NextSyncToken ?? conn.SyncToken);
            conn.RecordSync();
            await db.SaveChangesAsync(ct);
            return new SyncResultDto(created, updated, removed, null);
        }
        catch (GoogleApiException ex)
        {
            conn.RecordError(ex.Message);
            await db.SaveChangesAsync(ct);
            return new SyncResultDto(created, updated, removed, ex.Message);
        }
        catch (HttpRequestException)
        {
            // Network blip: leave the connection healthy - the next pass will simply try again.
            return new SyncResultDto(0, 0, 0, "Could not reach Google. Try again in a moment.");
        }
    }

    // ── Mapping ─────────────────────────────────────────────────────────────────────────────

    private sealed record Parsed(string Title, string? Description, string? Location, DateTime Start, DateTime End,
        bool AllDay, string? TimeZone, string? MeetUrl, bool IsOrganizer,
        List<(string Email, string? Name, string? Response)> Attendees);

    private static Parsed? Parse(JsonElement item)
    {
        if (!item.TryGetProperty("start", out var s) || !item.TryGetProperty("end", out var e)) return null;

        DateTime start, end; bool allDay; string? tz = null;
        if (s.TryGetProperty("date", out var sd))
        {
            allDay = true;
            start = DateTime.SpecifyKind(DateTime.ParseExact(sd.GetString()!, "yyyy-MM-dd", CultureInfo.InvariantCulture), DateTimeKind.Utc);
            end = e.TryGetProperty("date", out var ed)
                ? DateTime.SpecifyKind(DateTime.ParseExact(ed.GetString()!, "yyyy-MM-dd", CultureInfo.InvariantCulture), DateTimeKind.Utc)
                : start.AddDays(1);
        }
        else if (s.TryGetProperty("dateTime", out var sdt) && e.TryGetProperty("dateTime", out var edt))
        {
            allDay = false;
            start = DateTimeOffset.Parse(sdt.GetString()!, CultureInfo.InvariantCulture).UtcDateTime;
            end = DateTimeOffset.Parse(edt.GetString()!, CultureInfo.InvariantCulture).UtcDateTime;
            tz = Str(s, "timeZone");
        }
        else return null;
        if (end <= start) end = allDay ? start.AddDays(1) : start.AddMinutes(30);

        var title = Str(item, "summary") ?? "(No title)";
        var attendees = new List<(string, string?, string?)>();
        if (item.TryGetProperty("attendees", out var arr))
            foreach (var a in arr.EnumerateArray())
                if (Str(a, "email") is { } mail)
                    attendees.Add((mail, Str(a, "displayName"), Str(a, "responseStatus")));

        var isOrganizer = !item.TryGetProperty("organizer", out var org)
                          || !org.TryGetProperty("self", out var self) || self.ValueKind != JsonValueKind.False;

        return new Parsed(
            title.Length > 300 ? title[..300] : title,
            Clip(Str(item, "description"), 4000), Clip(Str(item, "location"), 300),
            start, end, allDay, tz, Str(item, "hangoutLink"), isOrganizer, attendees);
    }

    private static object BuildBody(CalendarEvent ev, bool newMeet)
    {
        var body = new Dictionary<string, object?>
        {
            ["summary"] = ev.Title,
            ["description"] = ev.Description,
            ["location"] = ev.Location,
            ["start"] = ev.IsAllDay
                ? new Dictionary<string, object?> { ["date"] = ev.StartUtc.ToString("yyyy-MM-dd") }
                : new Dictionary<string, object?> { ["dateTime"] = Utc(ev.StartUtc), ["timeZone"] = ev.TimeZone ?? "UTC" },
            ["end"] = ev.IsAllDay
                ? new Dictionary<string, object?> { ["date"] = ev.EndUtc.ToString("yyyy-MM-dd") }
                : new Dictionary<string, object?> { ["dateTime"] = Utc(ev.EndUtc), ["timeZone"] = ev.TimeZone ?? "UTC" },
            ["attendees"] = ev.Attendees.Select(a => new Dictionary<string, object?>
                { ["email"] = a.Email, ["displayName"] = a.Name }).ToList(),
        };
        if (newMeet)
            body["conferenceData"] = new Dictionary<string, object?>
            {
                ["createRequest"] = new Dictionary<string, object?>
                {
                    ["requestId"] = Guid.NewGuid().ToString("N"),
                    ["conferenceSolutionKey"] = new Dictionary<string, object?> { ["type"] = "hangoutsMeet" },
                },
            };
        return body;
    }

    private static string Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc).ToString("yyyy-MM-ddTHH:mm:ss'Z'");
    private static string? Str(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    private static string? Clip(string? s, int max) => s is null ? null : s.Length > max ? s[..max] : s;
}
