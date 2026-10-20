using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Library.Application.Reminders;

/// <summary>Sends a library notice. Returns false when nothing left the building.</summary>
public interface ILibraryEmailService
{
    /// <summary>False when the deployment has no SMTP account configured.</summary>
    bool IsConfigured { get; }

    Task<bool> SendAsync(string toEmail, string toName, string fromName, string subject, string html,
        CancellationToken ct = default);
}

/// <summary>Works out which notices are owed for the current workspace, and sends them.</summary>
public interface ILibraryReminderSender
{
    /// <param name="daily">Include due-soon and overdue notices; false sends "ready for pickup" only.</param>
    /// <param name="dryRun">Report what would go out without sending or recording anything.</param>
    Task<ReminderRunDto> RunAsync(string today, bool daily, bool dryRun, CancellationToken ct);
}

public sealed record ReminderSettingsDto(
    bool Enabled, int DueSoonDays, int OverdueEveryDays, int OverdueMaxReminders, bool NotifyReady,
    string? LibraryName, string TimeZoneId, string? LastDailyRunOn, bool EmailConfigured);

/// <summary>One email that was, or would be, sent.</summary>
public sealed record ReminderPreviewDto(string Kind, string MemberName, string ToEmail, IReadOnlyList<string> Titles);

/// <param name="NoEmail">Members owed a notice who have no email address on file.</param>
public sealed record ReminderRunDto(
    bool DryRun, int DueSoon, int Overdue, int Ready, int Failed, int NoEmail,
    IReadOnlyList<ReminderPreviewDto> Emails);

public sealed record ReminderLogDto(
    Guid Id, string Kind, string MemberName, string ToEmail, string Title, string Status, string? Error,
    DateTime CreatedAt);

public sealed record GetReminderSettingsQuery : IQuery<ReminderSettingsDto>;

public sealed record UpdateReminderSettingsCommand(
    bool Enabled, int DueSoonDays, int OverdueEveryDays, int OverdueMaxReminders, bool NotifyReady,
    string? LibraryName, string TimeZoneId) : ICommand<ReminderSettingsDto>;

public sealed record RunRemindersCommand(bool DryRun, string? Today) : ICommand<ReminderRunDto>;

public sealed record GetReminderLogQuery : IQuery<IReadOnlyList<ReminderLogDto>>;

public sealed class UpdateReminderSettingsValidator : AbstractValidator<UpdateReminderSettingsCommand>
{
    public UpdateReminderSettingsValidator()
    {
        RuleFor(x => x.DueSoonDays).InclusiveBetween(0, 30).WithMessage("Due-soon notice must be 0 to 30 days before.");
        RuleFor(x => x.OverdueEveryDays).InclusiveBetween(0, 60).WithMessage("Overdue notices must be 0 to 60 days apart.");
        RuleFor(x => x.OverdueMaxReminders).InclusiveBetween(0, 12).WithMessage("At most 12 overdue notices per loan.");
        RuleFor(x => x.LibraryName).MaximumLength(200);
        RuleFor(x => x.TimeZoneId).NotEmpty().WithMessage("Choose a time zone.").MaximumLength(100);
    }
}
