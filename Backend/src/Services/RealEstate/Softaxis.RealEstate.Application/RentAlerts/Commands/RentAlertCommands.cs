using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.RentAlerts.Dtos;

namespace Softaxis.RealEstate.Application.RentAlerts.Commands;

public sealed record UpdateRentAlertSettingsCommand(
    bool Enabled, string DueReminderDaysBefore, int OverdueRepeatDays, int OverdueMaxReminders,
    string ExpiryReminderDaysBefore, string? CcEmails, bool CcAllRealEstateUsers, string? TimeZoneId)
    : ICommand<RentAlertSettingsDto>;

public sealed class UpdateRentAlertSettingsValidator : AbstractValidator<UpdateRentAlertSettingsCommand>
{
    public UpdateRentAlertSettingsValidator()
    {
        RuleFor(x => x.OverdueRepeatDays).InclusiveBetween(1, 90);
        RuleFor(x => x.OverdueMaxReminders).InclusiveBetween(0, 50);
        RuleFor(x => x.DueReminderDaysBefore).Must(HasAnOffset)
            .WithMessage("Enter at least one number of days, e.g. 30,7,1.");
        RuleFor(x => x.ExpiryReminderDaysBefore).Must(HasAnOffset)
            .WithMessage("Enter at least one number of days, e.g. 90,60,30.");
    }

    private static bool HasAnOffset(string csv) =>
        (csv ?? string.Empty).Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(s => int.TryParse(s, out var n) && n >= 0);
}

/// <summary>Run the sweep for THIS workspace immediately. The daily background pass covers every
/// workspace; this is the "test it now" path and is what makes the settings screen verifiable.</summary>
public sealed record RunRentAlertSweepCommand(bool DryRun = false) : ICommand<RentAlertRunResultDto>;
