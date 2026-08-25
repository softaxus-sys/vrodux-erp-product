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
            .Select(x => new { x.Status, x.LateMinutes })
            .ToListAsync(ct);

        var todayPresent = todayCounts.Count(c => c.Status == "present");
        var todayAbsent  = todayCounts.Count(c => c.Status == "absent");

        // Counted from recorded lateness, not from a "late" status: nothing ever set that status,
        // so this figure was permanently zero.
        var todayLate    = todayCounts.Count(c => c.LateMinutes > 0);
        var todayTotal   = todayCounts.Count;

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
