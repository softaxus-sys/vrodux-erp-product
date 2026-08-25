using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Abstractions;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.LeavePolicies.Queries;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Application.Self.Commands;
using Softaxis.HR.Application.Self.Dtos;
using Softaxis.HR.Application.Self.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Handlers.Attendance;
using Softaxis.HR.Infrastructure.Handlers.Leaves;
using Softaxis.HR.Infrastructure.Handlers.WorkSchedules;
using Softaxis.HR.Infrastructure.Persistence;
using MediatR;

namespace Softaxis.HR.Infrastructure.Handlers.Self;

// ── Profile ──────────────────────────────────────────────────────────────────

internal sealed class GetMyProfileHandler(HrDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyProfileQuery, MyProfileDto>
{
    public async Task<Result<MyProfileDto>> Handle(GetMyProfileQuery query, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<MyProfileDto>(found.Error);

        var e = found.Value;
        return Result.Success(new MyProfileDto(
            e.Id, e.EmployeeNumber, e.FullName, e.Email, e.Phone, e.JobTitle, e.DepartmentName,
            e.EmploymentType, e.JoiningDate, e.Status, e.BasicSalary, e.Nationality,
            e.EmiratesId, e.PassportNumber, e.VisaExpiry, e.BankAccount, e.Iban, e.AvatarData));
    }
}

// ── Leave ────────────────────────────────────────────────────────────────────

internal sealed class GetMyLeavesHandler(HrDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyLeavesQuery, IReadOnlyList<LeaveDto>>
{
    public async Task<Result<IReadOnlyList<LeaveDto>>> Handle(GetMyLeavesQuery query, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<IReadOnlyList<LeaveDto>>(found.Error);

        var rows = await db.Leaves
            .AsNoTracking()
            .Where(l => !l.IsDeleted && l.EmployeeId == found.Value.Id)
            .OrderByDescending(l => l.StartDate)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<LeaveDto>>(rows.Select(LeaveMappings.ToDto).ToList());
    }
}

internal sealed class GetMyLeaveBalancesHandler(HrDbContext db, ICurrentUser currentUser, ISender sender)
    : IQueryHandler<GetMyLeaveBalancesQuery, IReadOnlyList<LeaveBalanceDto>>
{
    public async Task<Result<IReadOnlyList<LeaveBalanceDto>>> Handle(
        GetMyLeaveBalancesQuery query, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<IReadOnlyList<LeaveBalanceDto>>(found.Error);

        // Delegates to the existing balance query rather than duplicating the entitlement maths,
        // so a policy change can never mean two different answers for the same employee.
        return await sender.Send(new GetEmployeeLeaveBalancesQuery(found.Value.Id, query.Year), ct);
    }
}

internal sealed class ApplyForLeaveHandler(HrDbContext db, ICurrentUser currentUser)
    : ICommandHandler<ApplyForLeaveCommand, LeaveDto>
{
    public async Task<Result<LeaveDto>> Handle(ApplyForLeaveCommand cmd, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<LeaveDto>(found.Error);

        var employee = found.Value;

        // The request is filed against the resolved employee — the caller cannot name a subject.
        // It lands as "pending", exactly like one an HR user files, so the existing approval flow
        // and the pending-days deduction in the balance both apply with no special casing.
        var leave = new Leave(
            employee.Id, employee.FullName, cmd.LeaveType,
            cmd.StartDate, cmd.EndDate, cmd.TotalDays, cmd.Reason);

        db.Leaves.Add(leave);
        await db.SaveChangesAsync(ct);

        return Result.Success(LeaveMappings.ToDto(leave));
    }
}

internal sealed class CancelMyLeaveHandler(HrDbContext db, ICurrentUser currentUser)
    : ICommandHandler<CancelMyLeaveCommand>
{
    public async Task<Result> Handle(CancelMyLeaveCommand cmd, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveTrackedAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure(found.Error);

        // Scoped by employee as well as id: a leave id belonging to a colleague simply is not found.
        var leave = await db.Leaves.FirstOrDefaultAsync(
            l => l.Id == cmd.LeaveId && l.EmployeeId == found.Value.Id && !l.IsDeleted, ct);
        if (leave is null)
            return Result.Failure(Error.NotFoundById("Leave", cmd.LeaveId));

        if (leave.Status is not ("pending" or "approved"))
            return Result.Failure(Error.Custom(
                "Leave.Conflict", $"A {leave.Status} request cannot be cancelled."));

        leave.Cancel();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Attendance ───────────────────────────────────────────────────────────────

internal static class SelfAttendance
{
    // Attendance is a local-time fact: a 09:00 arrival in Dubai is 05:00 UTC, so stamping server
    // time would make every employee look four hours early and no lateness rule could work. The
    // date comes from the same local clock, or a late-evening check-in lands on tomorrow.
    public static string TodayIn(WorkSchedule? schedule) =>
        WorkScheduleRules.LocalNow(schedule).ToString("yyyy-MM-dd");

    public static string NowIn(WorkSchedule? schedule) =>
        WorkScheduleRules.LocalNow(schedule).ToString("HH:mm");

    public static MyAttendanceTodayDto ToDto(AttendanceLog? log, WorkSchedule? schedule)
    {
        var local = WorkScheduleRules.LocalNow(schedule);

        return new MyAttendanceTodayDto(
            log?.Date ?? local.ToString("yyyy-MM-dd"),
            log?.CheckIn,
            log?.CheckOut,
            log?.WorkingHours,
            log?.Status,
            log?.LateMinutes,
            schedule?.StartTime,
            schedule?.EndTime,
            schedule?.GraceMinutes ?? 0,
            WorkScheduleRules.IsWorkingDay(schedule, local));
    }

    /// <summary>Hours between two HH:mm stamps, rounded to two decimals; null if unparseable.</summary>
    public static decimal? HoursBetween(string? checkIn, string? checkOut)
    {
        if (!TimeSpan.TryParse(checkIn, out var start) || !TimeSpan.TryParse(checkOut, out var end))
            return null;

        var span = end - start;
        if (span < TimeSpan.Zero) span += TimeSpan.FromDays(1);   // shift crossing midnight
        return Math.Round((decimal)span.TotalHours, 2);
    }
}

internal sealed class GetMyAttendanceTodayHandler(HrDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyAttendanceTodayQuery, MyAttendanceTodayDto>
{
    public async Task<Result<MyAttendanceTodayDto>> Handle(
        GetMyAttendanceTodayQuery query, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<MyAttendanceTodayDto>(found.Error);

        var schedule = await WorkScheduleLookup.FindAsync(db, ct);
        var today    = SelfAttendance.TodayIn(schedule);

        var log = await db.AttendanceLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.EmployeeId == found.Value.Id && a.Date == today, ct);

        return Result.Success(SelfAttendance.ToDto(log, schedule));
    }
}

internal sealed class GetMyAttendanceHandler(HrDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyAttendanceQuery, IReadOnlyList<AttendanceLogDto>>
{
    public async Task<Result<IReadOnlyList<AttendanceLogDto>>> Handle(
        GetMyAttendanceQuery query, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<IReadOnlyList<AttendanceLogDto>>(found.Error);

        var q = db.AttendanceLogs.AsNoTracking().Where(a => a.EmployeeId == found.Value.Id);

        // Dates are yyyy-MM-dd strings throughout HR, so ordinal string compares are correct here.
        if (!string.IsNullOrWhiteSpace(query.FromDate)) q = q.Where(a => a.Date.CompareTo(query.FromDate) >= 0);
        if (!string.IsNullOrWhiteSpace(query.ToDate))   q = q.Where(a => a.Date.CompareTo(query.ToDate) <= 0);

        var rows = await q.OrderByDescending(a => a.Date).Take(200).ToListAsync(ct);
        return Result.Success<IReadOnlyList<AttendanceLogDto>>(
            rows.Select(AttendanceMappings.ToDto).ToList());
    }
}

internal sealed class CheckInHandler(HrDbContext db, ICurrentUser currentUser)
    : ICommandHandler<CheckInCommand, MyAttendanceTodayDto>
{
    public async Task<Result<MyAttendanceTodayDto>> Handle(CheckInCommand cmd, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveTrackedAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<MyAttendanceTodayDto>(found.Error);

        var employee = found.Value;
        var schedule = await WorkScheduleLookup.FindAsync(db, ct);
        var today    = SelfAttendance.TodayIn(schedule);
        var now      = SelfAttendance.NowIn(schedule);
        var late     = WorkScheduleRules.LateMinutes(schedule, now);

        var log = await db.AttendanceLogs
            .FirstOrDefaultAsync(a => a.EmployeeId == employee.Id && a.Date == today, ct);

        if (log is not null && !string.IsNullOrWhiteSpace(log.CheckIn))
            return Result.Failure<MyAttendanceTodayDto>(Error.Custom(
                "Attendance.Conflict", $"You already checked in today at {log.CheckIn}."));

        if (log is null)
        {
            log = new AttendanceLog(employee.Id, employee.FullName, today,
                now, null, null, "present", null, late);
            db.AttendanceLogs.Add(log);
        }
        else
        {
            // HR may have pre-created today's row (marked absent, say) — fill in the check-in
            // rather than refusing, otherwise an employee who arrives late can never check in.
            log.Update(now, log.CheckOut, log.WorkingHours, "present", log.Notes, late);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(SelfAttendance.ToDto(log, schedule));
    }
}

internal sealed class CheckOutHandler(HrDbContext db, ICurrentUser currentUser)
    : ICommandHandler<CheckOutCommand, MyAttendanceTodayDto>
{
    public async Task<Result<MyAttendanceTodayDto>> Handle(CheckOutCommand cmd, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveTrackedAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<MyAttendanceTodayDto>(found.Error);

        var schedule = await WorkScheduleLookup.FindAsync(db, ct);
        var today    = SelfAttendance.TodayIn(schedule);

        var log = await db.AttendanceLogs
            .FirstOrDefaultAsync(a => a.EmployeeId == found.Value.Id && a.Date == today, ct);

        if (log is null || string.IsNullOrWhiteSpace(log.CheckIn))
            return Result.Failure<MyAttendanceTodayDto>(Error.Custom(
                "Attendance.Conflict", "You have not checked in today."));

        var now = SelfAttendance.NowIn(schedule);
        log.Update(log.CheckIn, now, SelfAttendance.HoursBetween(log.CheckIn, now), log.Status, log.Notes);

        await db.SaveChangesAsync(ct);
        return Result.Success(SelfAttendance.ToDto(log, schedule));
    }
}

// ── Payslips ─────────────────────────────────────────────────────────────────

internal sealed class GetMyPayslipsHandler(HrDbContext db, ICurrentUser currentUser, ISender sender)
    : IQueryHandler<GetMyPayslipsQuery, IReadOnlyList<EmployeePayslipDto>>
{
    public async Task<Result<IReadOnlyList<EmployeePayslipDto>>> Handle(
        GetMyPayslipsQuery query, CancellationToken ct)
    {
        var found = await CurrentEmployee.ResolveAsync(db, currentUser, ct);
        if (!found.IsSuccess) return Result.Failure<IReadOnlyList<EmployeePayslipDto>>(found.Error);

        // Reuses the employee payslip query, which already returns processed/paid runs only —
        // a draft run is not a payslip anyone has received.
        return await sender.Send(new GetEmployeePayslipsQuery(found.Value.Id), ct);
    }
}
