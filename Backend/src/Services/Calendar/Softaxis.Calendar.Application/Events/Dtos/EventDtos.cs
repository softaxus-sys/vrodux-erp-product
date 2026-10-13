namespace Softaxis.Calendar.Application.Events.Dtos;

public sealed record AttendeeDto(string Email, string? Name, string ResponseStatus);

public sealed record CalendarEventDto(
    Guid Id,
    string Title,
    string? Description,
    string? Location,
    DateTime StartUtc,
    DateTime EndUtc,
    bool IsAllDay,
    string? TimeZone,
    string? MeetUrl,
    string Source,
    /// <summary>True when the signed-in user owns this event and may edit or delete it.</summary>
    bool CanEdit,
    string? OwnerName,
    IReadOnlyList<AttendeeDto> Attendees,
    /// <summary>local | synced | error - whether this event is mirrored on Google.</summary>
    string SyncStatus,
    string? SyncError);

public sealed record AttendeeInput(string Email, string? Name);

/// <summary>The two ends of a push or a pull, reported to the user.</summary>
public sealed record SyncResultDto(int Created, int Updated, int Removed, string? Error);
