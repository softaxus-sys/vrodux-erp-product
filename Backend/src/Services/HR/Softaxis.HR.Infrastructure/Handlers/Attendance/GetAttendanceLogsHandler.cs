using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.Attendance.Queries;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal sealed class GetAttendanceLogsHandler(HrDbContext db)
    : IQueryHandler<GetAttendanceLogsQuery, PagedResult<AttendanceLogDto>>
{
    public async Task<Result<PagedResult<AttendanceLogDto>>> Handle(GetAttendanceLogsQuery query, CancellationToken ct)
    {
        IQueryable<AttendanceLog> q = db.AttendanceLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Date))
            q = q.Where(x => x.Date == query.Date);

        if (!string.IsNullOrWhiteSpace(query.DateFrom))
            q = q.Where(x => string.Compare(x.Date, query.DateFrom) >= 0);

        if (!string.IsNullOrWhiteSpace(query.DateTo))
            q = q.Where(x => string.Compare(x.Date, query.DateTo) <= 0);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (query.EmployeeId.HasValue)
            q = q.Where(x => x.EmployeeId == query.EmployeeId.Value);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.Date).ThenBy(x => x.EmployeeName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new AttendanceLogDto(
                x.Id, x.EmployeeId, x.EmployeeName, x.Date,
                x.CheckIn, x.CheckOut, x.WorkingHours,
                x.Status, x.Notes, x.LateMinutes, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<AttendanceLogDto>(
            items, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
