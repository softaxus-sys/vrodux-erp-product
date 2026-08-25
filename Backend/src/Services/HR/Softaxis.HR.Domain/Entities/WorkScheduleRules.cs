using System.Globalization;

namespace Softaxis.HR.Domain.Entities;

/// <summary>
/// Pure rules over a <see cref="WorkSchedule"/> — no database, no clock of its own, so the same
/// arrival produces the same answer wherever it is evaluated.
/// </summary>
public static class WorkScheduleRules
{
    /// <summary>
    /// The tenant's local "now", or UTC when the schedule names a timezone this machine does not
    /// have. Falling back is deliberate: a bad timezone id must not stop someone checking in.
    /// </summary>
    public static DateTime LocalNow(WorkSchedule? schedule)
    {
        if (schedule is null) return DateTime.UtcNow;
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(schedule.TimeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return DateTime.UtcNow;
        }
    }

    /// <summary>
    /// Minutes late, counted from the end of the grace period — so an arrival inside grace is 0,
    /// not a small positive number. Null when there is no schedule or the time is unreadable,
    /// which reads as "unknown" rather than "on time".
    /// </summary>
    public static int? LateMinutes(WorkSchedule? schedule, string? checkIn)
    {
        if (schedule is null) return null;
        if (!TryParseHm(checkIn, out var arrival)) return null;
        if (!TryParseHm(schedule.StartTime, out var start)) return null;

        var allowed = start.Add(TimeSpan.FromMinutes(schedule.GraceMinutes));
        var late    = arrival - allowed;
        return late > TimeSpan.Zero ? (int)Math.Round(late.TotalMinutes) : 0;
    }

    /// <summary>True when the given date is a working day under this schedule.</summary>
    public static bool IsWorkingDay(WorkSchedule? schedule, DateTime date)
    {
        if (schedule is null) return true;
        var days = ParseWorkingDays(schedule.WorkingDays);
        return days.Count == 0 || days.Contains((int)date.DayOfWeek);
    }

    public static HashSet<int> ParseWorkingDays(string? csv) =>
        (csv ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var d) ? d : -1)
            .Where(d => d is >= 0 and <= 6)
            .ToHashSet();

    private static bool TryParseHm(string? value, out TimeSpan result)
    {
        result = default;
        return !string.IsNullOrWhiteSpace(value)
            && TimeSpan.TryParseExact(value.Trim(), @"hh\:mm", CultureInfo.InvariantCulture, out result);
    }
}
