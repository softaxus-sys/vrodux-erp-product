namespace Softaxis.HR.Application.WorkSchedules.Dtos;

/// <param name="WorkingDays">Day numbers, 0 = Sunday, as sent and stored.</param>
public sealed record WorkScheduleDto(
    Guid     Id,
    string   Name,
    string   StartTime,
    string   EndTime,
    int      GraceMinutes,
    IReadOnlyList<int> WorkingDays,
    string   TimeZoneId);
