using System.Globalization;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Automations.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Automations;

/// <summary>Entity → DTO mapping + human-readable schedule labels for automation rules/runs.</summary>
internal static class AutomationMappings
{
    private static readonly string[] Days =
        ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    public static string FrequencyString(AiRuleFrequency f) => f switch
    {
        AiRuleFrequency.Interval => "interval",
        AiRuleFrequency.Hourly   => "hourly",
        AiRuleFrequency.Daily    => "daily",
        AiRuleFrequency.Weekly   => "weekly",
        _                        => "daily",
    };

    public static AiRuleFrequency ParseFrequency(string? f) => f?.Trim().ToLowerInvariant() switch
    {
        "interval" => AiRuleFrequency.Interval,
        "hourly"   => AiRuleFrequency.Hourly,
        "weekly"   => AiRuleFrequency.Weekly,
        _          => AiRuleFrequency.Daily,
    };

    public static string ScheduleLabel(AiAutomationRule r)
    {
        var time = $"{(r.HourUtc ?? 0):00}:{r.MinuteUtc:00} UTC";
        return r.Frequency switch
        {
            AiRuleFrequency.Interval => $"Every {r.IntervalMinutes ?? 60} min",
            AiRuleFrequency.Hourly   => $"Hourly at :{r.MinuteUtc:00}",
            AiRuleFrequency.Daily    => $"Daily at {time}",
            AiRuleFrequency.Weekly   => $"Weekly on {Days[Math.Clamp(r.DayOfWeekUtc ?? 1, 0, 6)]} at {time}",
            _                        => "—",
        };
    }

    public static AutomationRunDto ToRunDto(AiAutomationRun run) => new(
        run.Id, run.RuleId, run.RuleName, run.TriggeredBy, run.Status,
        run.Summary, run.ToolsUsed, run.Error, run.PendingToolName,
        run.StartedAt, run.CompletedAt);

    public static AutomationRuleSummaryDto ToSummary(AiAutomationRule r, int pendingCount) => new(
        r.Id, r.Name, r.Agent, r.Agent is null ? null : AiAgents.Label(r.Agent), r.Mode,
        FrequencyString(r.Frequency), ScheduleLabel(r), r.Enabled, r.NotifyTelegram,
        r.RunAsUserName, r.LastRunAt, r.NextRunAt, r.LastStatus, r.RunCount, pendingCount);

    public static AutomationRuleDto ToDto(AiAutomationRule r, IReadOnlyList<AutomationRunDto> recentRuns) => new(
        r.Id, r.Name, r.Description, r.Agent, r.Agent is null ? null : AiAgents.Label(r.Agent),
        r.Instruction, r.RunAsUserId, r.RunAsUserName, r.Mode,
        FrequencyString(r.Frequency), r.IntervalMinutes, r.HourUtc, r.MinuteUtc, r.DayOfWeekUtc,
        ScheduleLabel(r), r.NotifyTelegram, r.Enabled,
        r.LastRunAt, r.NextRunAt, r.LastStatus, r.LastError, r.RunCount, recentRuns);

    // Kept for parity if a culture-specific format is ever needed.
    public static string Iso(DateTime dt) => dt.ToString("o", CultureInfo.InvariantCulture);
}
