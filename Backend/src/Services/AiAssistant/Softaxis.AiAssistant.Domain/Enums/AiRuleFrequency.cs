namespace Softaxis.AiAssistant.Domain.Enums;

/// <summary>How often an automation rule fires. Drives the deterministic NextRunAt calculation.</summary>
public enum AiRuleFrequency
{
    /// <summary>Every N minutes (uses <c>IntervalMinutes</c>).</summary>
    Interval = 0,

    /// <summary>Once an hour at <c>MinuteUtc</c> past the hour.</summary>
    Hourly = 1,

    /// <summary>Once a day at <c>HourUtc</c>:<c>MinuteUtc</c>.</summary>
    Daily = 2,

    /// <summary>Once a week on <c>DayOfWeekUtc</c> at <c>HourUtc</c>:<c>MinuteUtc</c>.</summary>
    Weekly = 3,
}
