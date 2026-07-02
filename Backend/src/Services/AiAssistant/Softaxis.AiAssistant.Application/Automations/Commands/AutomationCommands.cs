using FluentValidation;
using Softaxis.AiAssistant.Application.Automations.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Automations.Commands;

/// <summary>
/// Create a scheduled automation rule. <see cref="RunAsUserId"/>/<see cref="RunAsUserName"/> default
/// to the current user when omitted. Schedule fields are interpreted per <see cref="Frequency"/>.
/// </summary>
public sealed record CreateAutomationRuleCommand(
    string Name,
    string? Description,
    string? Agent,
    string Instruction,
    Guid? RunAsUserId,
    string? RunAsUserName,
    string Mode,
    string Frequency,
    int? IntervalMinutes,
    int? HourUtc,
    int MinuteUtc,
    int? DayOfWeekUtc,
    bool NotifyTelegram,
    bool Enabled) : ICommand<AutomationRuleDto>;

public sealed record UpdateAutomationRuleCommand(
    Guid Id,
    string Name,
    string? Description,
    string? Agent,
    string Instruction,
    Guid? RunAsUserId,
    string? RunAsUserName,
    string Mode,
    string Frequency,
    int? IntervalMinutes,
    int? HourUtc,
    int MinuteUtc,
    int? DayOfWeekUtc,
    bool NotifyTelegram) : ICommand<AutomationRuleDto>;

public sealed record ToggleAutomationRuleCommand(Guid Id, bool Enabled) : ICommand<AutomationRuleDto>;

public sealed record DeleteAutomationRuleCommand(Guid Id) : ICommand;

/// <summary>Run a rule immediately (out of schedule) as its run-as user.</summary>
public sealed record RunAutomationRuleNowCommand(Guid Id) : ICommand<AutomationRunDto>;

/// <summary>
/// Resolve a confirm-mode run that is waiting on a write. <see cref="Approve"/> = true executes the
/// queued action as the rule's run-as user; false discards it.
/// </summary>
public sealed record ConfirmAutomationRunCommand(Guid RunId, bool Approve) : ICommand<AutomationRunDto>;

// ── Validators ────────────────────────────────────────────────────────────────

file static class ScheduleRules
{
    public static readonly string[] Frequencies = ["interval", "hourly", "daily", "weekly"];
    public static readonly string[] Modes       = ["autopilot", "confirm"];
}

public sealed class CreateAutomationRuleCommandValidator : AbstractValidator<CreateAutomationRuleCommand>
{
    public CreateAutomationRuleCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Agent).MaximumLength(40);
        RuleFor(x => x.Instruction).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.Mode).Must(m => ScheduleRules.Modes.Contains(m, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Mode must be 'autopilot' or 'confirm'.");
        RuleFor(x => x.Frequency).Must(f => ScheduleRules.Frequencies.Contains(f, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Frequency must be one of: interval, hourly, daily, weekly.");
        RuleFor(x => x.MinuteUtc).InclusiveBetween(0, 59);
        RuleFor(x => x.IntervalMinutes).GreaterThanOrEqualTo(5)
            .When(x => string.Equals(x.Frequency, "interval", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Interval must be at least 5 minutes.");
        RuleFor(x => x.HourUtc).InclusiveBetween(0, 23)
            .When(x => x.HourUtc.HasValue);
        RuleFor(x => x.DayOfWeekUtc).InclusiveBetween(0, 6)
            .When(x => x.DayOfWeekUtc.HasValue);
    }
}

public sealed class UpdateAutomationRuleCommandValidator : AbstractValidator<UpdateAutomationRuleCommand>
{
    public UpdateAutomationRuleCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.Agent).MaximumLength(40);
        RuleFor(x => x.Instruction).NotEmpty().MaximumLength(4000);
        RuleFor(x => x.Mode).Must(m => ScheduleRules.Modes.Contains(m, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Mode must be 'autopilot' or 'confirm'.");
        RuleFor(x => x.Frequency).Must(f => ScheduleRules.Frequencies.Contains(f, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Frequency must be one of: interval, hourly, daily, weekly.");
        RuleFor(x => x.MinuteUtc).InclusiveBetween(0, 59);
        RuleFor(x => x.IntervalMinutes).GreaterThanOrEqualTo(5)
            .When(x => string.Equals(x.Frequency, "interval", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Interval must be at least 5 minutes.");
        RuleFor(x => x.HourUtc).InclusiveBetween(0, 23).When(x => x.HourUtc.HasValue);
        RuleFor(x => x.DayOfWeekUtc).InclusiveBetween(0, 6).When(x => x.DayOfWeekUtc.HasValue);
    }
}
