using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.Attendance.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal sealed class GetAttendanceSummaryHandler(HrDbContext db)
    : IQueryHandler<GetAttendanceSummaryQuery, AttendanceSummaryDto>
{
    public async Task<Result<AttendanceSummaryDto>> Handle(GetAttendanceSummaryQuery query, CancellationToken ct)
    {
        var today           = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var thisMonthPrefix = DateTime.UtcNow.ToString("yyyy-MM");

        var todayCounts = await db.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Date == today)
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var todayPresent = todayCounts.FirstOrDefault(c => c.Status == "present")?.Count ?? 0;
        var todayAbsent  = todayCounts.FirstOrDefault(c => c.Status == "absent")?.Count  ?? 0;
        var todayLate    = todayCounts.FirstOrDefault(c => c.Status == "late")?.Count    ?? 0;
        var todayTotal   = todayCounts.Sum(c => c.Count);

        var monthLogs = await db.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Date.StartsWith(thisMonthPrefix))
            .Select(x => new { x.Status, x.WorkingHours })
            .ToListAsync(ct);

        var monthPresent    = monthLogs.Count(x => x.Status == "present");
        var avgWorkingHours = monthLogs
            .Where(x => x.WorkingHours.HasValue)
            .Select(x => (double)x.WorkingHours!.Value)
            .DefaultIfEmpty(0)
            .Average();

        return Result.Success(new AttendanceSummaryDto(
            new AttendanceTodayDto(today, todayTotal, todayPresent, todayAbsent, todayLate),
            new AttendanceThisMonthDto(monthPresent, monthLogs.Count, Math.Round(avgWorkingHours, 2)),
            todayPresent, todayLate, todayAbsent, todayTotal));
    }
}
