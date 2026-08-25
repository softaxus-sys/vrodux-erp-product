using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.WorkSchedules.Commands;
using Softaxis.HR.Application.WorkSchedules.Dtos;
using Softaxis.HR.Application.WorkSchedules.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.WorkSchedules;

/// <summary>
/// Loading the tenant's office hours, and creating them the first time they are needed.
///
/// <para>Seeding on first read rather than at startup keeps it tenant-scoped: the seed runs inside
/// a real request, so the row is stamped with the caller's tenant. A startup seed has no ambient
/// tenant and would write rows nobody can see — the mistake found in Module 5g.</para>
/// </summary>
internal static class WorkScheduleLookup
{
    // 09:00–18:00, 15 minutes of grace, Monday–Friday, UAE time: the ordinary office week for
    // this product's tenants, and every part of it is editable afterwards.
    public const string DefaultTimeZone = "Asia/Dubai";

    public static WorkSchedule BuildDefault() =>
        new("Standard office hours", "09:00", "18:00", 15, "1,2,3,4,5", DefaultTimeZone);

    /// <summary>The tenant's schedule, or null when it has none and none should be created.</summary>
    public static Task<WorkSchedule?> FindAsync(HrDbContext db, CancellationToken ct) =>
        db.WorkSchedules
            .AsNoTracking()
            .Where(s => !s.IsDeleted && s.IsActive)
            .OrderByDescending(s => s.IsDefault)
            .FirstOrDefaultAsync(ct);

    /// <summary>The tenant's schedule, seeding the default if this is the first time.</summary>
    public static async Task<WorkSchedule> GetOrCreateAsync(HrDbContext db, CancellationToken ct)
    {
        var existing = await db.WorkSchedules
            .Where(s => !s.IsDeleted && s.IsActive)
            .OrderByDescending(s => s.IsDefault)
            .FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var seeded = BuildDefault();
        db.WorkSchedules.Add(seeded);
        await db.SaveChangesAsync(ct);
        return seeded;
    }

    public static WorkScheduleDto ToDto(WorkSchedule s) => new(
        s.Id, s.Name, s.StartTime, s.EndTime, s.GraceMinutes,
        WorkScheduleRules.ParseWorkingDays(s.WorkingDays).OrderBy(d => d).ToList(),
        s.TimeZoneId);
}

internal sealed class GetWorkScheduleHandler(HrDbContext db)
    : IQueryHandler<GetWorkScheduleQuery, WorkScheduleDto>
{
    public async Task<Result<WorkScheduleDto>> Handle(GetWorkScheduleQuery query, CancellationToken ct)
        => Result.Success(WorkScheduleLookup.ToDto(await WorkScheduleLookup.GetOrCreateAsync(db, ct)));
}

internal sealed class UpdateWorkScheduleHandler(HrDbContext db)
    : ICommandHandler<UpdateWorkScheduleCommand, WorkScheduleDto>
{
    public async Task<Result<WorkScheduleDto>> Handle(UpdateWorkScheduleCommand cmd, CancellationToken ct)
    {
        // Validated here as well as in the validator: an id this machine cannot resolve would make
        // every later lateness judgement silently fall back to UTC.
        if (!IsKnownTimeZone(cmd.TimeZoneId))
            return Result.Failure<WorkScheduleDto>(Error.Custom(
                "WorkSchedule.TimeZone", $"'{cmd.TimeZoneId}' is not a timezone this server recognises."));

        var schedule = await WorkScheduleLookup.GetOrCreateAsync(db, ct);
        var tracked  = await db.WorkSchedules.FirstAsync(s => s.Id == schedule.Id, ct);

        tracked.Update(cmd.Name, cmd.StartTime, cmd.EndTime, cmd.GraceMinutes,
            string.Join(',', cmd.WorkingDays.Distinct().OrderBy(d => d)), cmd.TimeZoneId);

        await db.SaveChangesAsync(ct);
        return Result.Success(WorkScheduleLookup.ToDto(tracked));
    }

    private static bool IsKnownTimeZone(string id)
    {
        try { TimeZoneInfo.FindSystemTimeZoneById(id); return true; }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException) { return false; }
    }
}
