namespace Softaxis.Calendar.Domain.Entities;

public static class EventSources
{
    public const string Vrodux = "vrodux";
    public const string Google = "google";
}

/// <summary>
/// One entry on a user's calendar. Either created here (and pushed to Google when the owner has
/// connected one) or pulled from Google. <see cref="GoogleEventId"/> is what makes the two sides one
/// event rather than two copies.
///
/// <para>All-day events store midnight-UTC dates and an <b>exclusive</b> end (a one-day event on the
/// 5th ends on the 6th) - Google's own convention, kept so nothing is translated twice.</para>
/// </summary>
public sealed class CalendarEvent
{
    private readonly List<CalendarAttendee> _attendees = [];
    private CalendarEvent() { }

    public CalendarEvent(Guid ownerUserId, string? ownerName, string title, DateTime startUtc, DateTime endUtc,
        bool isAllDay, string? timeZone, string source)
    {
        Id = Guid.NewGuid();
        OwnerUserId = ownerUserId; OwnerName = ownerName;
        Title = title; StartUtc = startUtc; EndUtc = endUtc; IsAllDay = isAllDay;
        TimeZone = timeZone; Source = source; IsOrganizer = true;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public Guid      OwnerUserId   { get; private set; }
    public string?   OwnerName     { get; private set; }
    public string    Title         { get; private set; } = "";
    public string?   Description   { get; private set; }
    public string?   Location      { get; private set; }
    public DateTime  StartUtc      { get; private set; }
    public DateTime  EndUtc        { get; private set; }
    public bool      IsAllDay      { get; private set; }
    public string?   TimeZone      { get; private set; }
    public string?   MeetUrl       { get; private set; }
    /// <summary>"vrodux" or "google" - where the event was first created.</summary>
    public string    Source        { get; private set; } = EventSources.Vrodux;
    /// <summary>False for an invitation from someone else: it can be seen but not edited or deleted here.</summary>
    public bool      IsOrganizer   { get; private set; } = true;
    public string?   GoogleEventId { get; private set; }
    public string?   GoogleEtag    { get; private set; }
    /// <summary>"local" (never pushed), "synced", or "error".</summary>
    public string    SyncStatus    { get; private set; } = "local";
    public string?   SyncError     { get; private set; }
    public bool      IsDeleted     { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public IReadOnlyCollection<CalendarAttendee> Attendees => _attendees;

    public void Update(string title, string? description, string? location, DateTime startUtc, DateTime endUtc,
        bool isAllDay, string? timeZone)
    {
        Title = title; Description = description; Location = location;
        StartUtc = startUtc; EndUtc = endUtc; IsAllDay = isAllDay; TimeZone = timeZone;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetDetails(string? description, string? location) { Description = description; Location = location; }

    public void ReplaceAttendees(IEnumerable<(string Email, string? Name, string? Response)> people)
    {
        var keep = people
            .Where(p => !string.IsNullOrWhiteSpace(p.Email))
            .GroupBy(p => p.Email.Trim().ToLowerInvariant()).Select(g => g.First()).ToList();
        _attendees.Clear();
        foreach (var p in keep)
            _attendees.Add(new CalendarAttendee(Id, p.Email.Trim(), p.Name, p.Response ?? "needsAction"));
    }

    public void SetMeetUrl(string? url) => MeetUrl = url;
    public void SetOrganizer(bool isOrganizer) => IsOrganizer = isOrganizer;

    public void LinkGoogle(string googleEventId, string? etag)
    {
        GoogleEventId = googleEventId; GoogleEtag = etag; SyncStatus = "synced"; SyncError = null;
    }

    public void RecordSyncError(string error)
    {
        SyncStatus = "error"; SyncError = error.Length > 500 ? error[..500] : error;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class CalendarAttendee
{
    private CalendarAttendee() { }

    public CalendarAttendee(Guid eventId, string email, string? name, string responseStatus)
    {
        Id = Guid.NewGuid(); EventId = eventId; Email = email; Name = name; ResponseStatus = responseStatus;
    }

    public Guid    Id             { get; private set; }
    public Guid    EventId        { get; private set; }
    public string  Email          { get; private set; } = "";
    public string? Name           { get; private set; }
    /// <summary>needsAction | accepted | declined | tentative - Google's own vocabulary.</summary>
    public string  ResponseStatus { get; private set; } = "needsAction";
}

/// <summary>
/// One user's link to their own Google account. Per user, not per workspace: a calendar is personal,
/// and one person's consent must never expose another's schedule.
/// </summary>
public sealed class CalendarConnection
{
    private CalendarConnection() { }

    public CalendarConnection(Guid userId)
    {
        Id = Guid.NewGuid(); UserId = userId; Status = "disconnected"; CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id           { get; private set; }
    public Guid      UserId       { get; private set; }
    public string    Provider     { get; private set; } = "google";
    public string?   AccountEmail { get; private set; }
    /// <summary>Encrypted JSON (access token, refresh token, expiry). Never returned to a client.</summary>
    public string?   Credentials  { get; private set; }
    /// <summary>Google's incremental-sync cursor: with it, a pull returns only what changed.</summary>
    public string?   SyncToken    { get; private set; }
    public string    Status       { get; private set; } = "disconnected"; // disconnected | connected | error
    public DateTime? LastSyncAt   { get; private set; }
    public string?   LastError    { get; private set; }
    public bool      IsDeleted    { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }

    public void SetCredentials(string encrypted) { Credentials = encrypted; Status = "connected"; LastError = null; UpdatedAt = DateTime.UtcNow; }
    public void SetAccount(string? email) { AccountEmail = email; }
    public void SetSyncToken(string? token) { SyncToken = token; }
    public void RecordSync() { LastSyncAt = DateTime.UtcNow; LastError = null; if (Status == "error") Status = "connected"; }
    public void RecordError(string error)
    {
        LastError = error.Length > 500 ? error[..500] : error; Status = "error"; UpdatedAt = DateTime.UtcNow;
    }
    public void Disconnect()
    {
        Credentials = null; SyncToken = null; Status = "disconnected"; UpdatedAt = DateTime.UtcNow;
    }
}
