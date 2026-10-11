using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Library.Application.Reminders;
using Softaxis.Library.Domain.Entities;
using Softaxis.Library.Infrastructure.Persistence;
using Softaxis.Library.Infrastructure.Services;

namespace Softaxis.Library.Infrastructure.Handlers.Reminders;

internal static class ReminderMappings
{
    public static ReminderSettingsDto ToDto(ReminderSettings s, bool emailConfigured) => new(
        s.Enabled, s.DueSoonDays, s.OverdueEveryDays, s.OverdueMaxReminders, s.NotifyReady, s.LibraryName,
        s.TimeZoneId, s.LastDailyRunOn, emailConfigured);
}

internal sealed class GetReminderSettingsHandler(LibraryDbContext db, ILibraryEmailService email)
    : IQueryHandler<GetReminderSettingsQuery, ReminderSettingsDto>
{
    public async Task<Result<ReminderSettingsDto>> Handle(GetReminderSettingsQuery q, CancellationToken ct) =>
        Result.Success(ReminderMappings.ToDto(await ReminderSettingsStore.GetOrCreateAsync(db, ct), email.IsConfigured));
}

internal sealed class UpdateReminderSettingsHandler(LibraryDbContext db, ILibraryEmailService email)
    : ICommandHandler<UpdateReminderSettingsCommand, ReminderSettingsDto>
{
    public async Task<Result<ReminderSettingsDto>> Handle(UpdateReminderSettingsCommand cmd, CancellationToken ct)
    {
        // An unknown zone would silently become UTC and date every notice by the wrong day.
        if (ReminderSettingsStore.FindZone(cmd.TimeZoneId) is null)
            return Result.Failure<ReminderSettingsDto>(Error.Custom("Reminder.InvalidStatus",
                $"\"{cmd.TimeZoneId}\" is not a time zone this server knows."));

        var settings = await ReminderSettingsStore.GetOrCreateAsync(db, ct);
        settings.Update(cmd.Enabled, cmd.DueSoonDays, cmd.OverdueEveryDays, cmd.OverdueMaxReminders,
            cmd.NotifyReady, cmd.LibraryName, cmd.TimeZoneId.Trim());
        await db.SaveChangesAsync(ct);
        return Result.Success(ReminderMappings.ToDto(settings, email.IsConfigured));
    }
}

internal sealed class RunRemindersHandler(ILibraryReminderSender sender, ILibraryEmailService email)
    : ICommandHandler<RunRemindersCommand, ReminderRunDto>
{
    public async Task<Result<ReminderRunDto>> Handle(RunRemindersCommand cmd, CancellationToken ct)
    {
        // Saying "sent" when nothing can leave the building is the one thing this must not do.
        if (!cmd.DryRun && !email.IsConfigured)
            return Result.Failure<ReminderRunDto>(Error.Custom("Reminder.Conflict",
                "Email is not set up on this server, so nothing can be sent. Use Preview to see what would go out."));

        return Result.Success(await sender.RunAsync(LibraryDates.Today(cmd.Today), daily: true, cmd.DryRun, ct));
    }
}

internal sealed class GetReminderLogHandler(LibraryDbContext db) : IQueryHandler<GetReminderLogQuery, IReadOnlyList<ReminderLogDto>>
{
    public async Task<Result<IReadOnlyList<ReminderLogDto>>> Handle(GetReminderLogQuery q, CancellationToken ct)
    {
        var rows = await db.ReminderLogs.AsNoTracking()
            .OrderByDescending(l => l.CreatedAt).Take(200).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ReminderLogDto>>(rows.Select(l => new ReminderLogDto(
            l.Id, l.Kind, l.MemberName, l.ToEmail, l.Title, l.Status, l.Error, l.CreatedAt)).ToList());
    }
}
