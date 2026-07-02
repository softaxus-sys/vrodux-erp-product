namespace Softaxis.AiAssistant.Application.Automations.Dtos;

/// <summary>Compact row for the automation-rules list.</summary>
public sealed record AutomationRuleSummaryDto(
    Guid Id,
    string Name,
    string? Agent,
    string? AgentLabel,
    string Mode,
    string Frequency,
    string ScheduleLabel,
    bool Enabled,
    bool NotifyTelegram,
    string RunAsUserName,
    DateTime? LastRunAt,
    DateTime? NextRunAt,
    string? LastStatus,
    int RunCount,
    int PendingCount);

/// <summary>Full automation rule (with recent run history) for the detail/edit view.</summary>
public sealed record AutomationRuleDto(
    Guid Id,
    string Name,
    string? Description,
    string? Agent,
    string? AgentLabel,
    string Instruction,
    Guid RunAsUserId,
    string RunAsUserName,
    string Mode,
    string Frequency,
    int? IntervalMinutes,
    int? HourUtc,
    int MinuteUtc,
    int? DayOfWeekUtc,
    string ScheduleLabel,
    bool NotifyTelegram,
    bool Enabled,
    DateTime? LastRunAt,
    DateTime? NextRunAt,
    string? LastStatus,
    string? LastError,
    int RunCount,
    IReadOnlyList<AutomationRunDto> RecentRuns);

/// <summary>One execution of a rule.</summary>
public sealed record AutomationRunDto(
    Guid Id,
    Guid RuleId,
    string RuleName,
    string TriggeredBy,
    string Status,
    string? Summary,
    string? ToolsUsed,
    string? Error,
    string? PendingToolName,
    DateTime StartedAt,
    DateTime? CompletedAt);
