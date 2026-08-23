namespace Softaxis.Identity.Application.AuditLogs.Queries.GetAuditLogs;

/// <summary>
/// Turns the caller's calendar-day filters into UTC instants.
///
/// The UI sends From/To from an <c>&lt;input type="date"&gt;</c> — a day on the VIEWER's calendar,
/// with no time and no zone. Audit rows are stored as UTC instants. Comparing the two directly was
/// wrong twice over:
///   • <b>Off by the viewer's offset</b> — "from 23 Aug" in GST (UTC+4) should start at 22 Aug
///     20:00 UTC, not 23 Aug 00:00 UTC.
///   • <b>The end day was excluded entirely</b> — "to 23 Aug" bound to 23 Aug 00:00 against an
///     inclusive <c>&lt;=</c>, so everything logged during that day fell outside the range. Picking
///     today as the end date reliably returned nothing from today.
/// </summary>
internal static class AuditLogFilterWindow
{
    /// <summary>Clamped so a malformed/hostile offset can't push the window wildly out.</summary>
    private static TimeSpan Offset(int minutes) =>
        TimeSpan.FromMinutes(Math.Clamp(minutes, -14 * 60, 14 * 60));

    /// <summary>Start of the caller's chosen day, as UTC.</summary>
    public static DateTime? StartUtc(DateTime? from, int tzOffsetMinutes)
    {
        if (!from.HasValue) return null;
        return DateTime.SpecifyKind(from.Value.Date - Offset(tzOffsetMinutes), DateTimeKind.Utc);
    }

    /// <summary>
    /// End of the caller's chosen day, as UTC — inclusive. A value that already carries a time is
    /// respected as-is (only the offset is applied), so an explicit instant is not widened.
    /// </summary>
    public static DateTime? EndUtc(DateTime? to, int tzOffsetMinutes)
    {
        if (!to.HasValue) return null;
        var local = to.Value.TimeOfDay == TimeSpan.Zero
            ? to.Value.Date.AddDays(1).AddTicks(-1)   // date-only → widen to 23:59:59.9999999
            : to.Value;
        return DateTime.SpecifyKind(local - Offset(tzOffsetMinutes), DateTimeKind.Utc);
    }

    /// <summary>The caller's current day as a UTC window, for the "Today" stat.</summary>
    public static (DateTime Start, DateTime End) TodayUtc(int tzOffsetMinutes)
    {
        var offset    = Offset(tzOffsetMinutes);
        var callerNow = DateTime.UtcNow + offset;
        var start     = callerNow.Date - offset;
        return (DateTime.SpecifyKind(start, DateTimeKind.Utc),
                DateTime.SpecifyKind(start.AddDays(1).AddTicks(-1), DateTimeKind.Utc));
    }
}
