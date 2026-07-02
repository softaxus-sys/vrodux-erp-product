using Softaxis.AiAssistant.Domain.Enums;

namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// A tenant-defined autonomous rule. On its schedule the assistant runs <see cref="Instruction"/>
/// (optionally scoped to a named <see cref="Agent"/>) as the <see cref="RunAsUserId"/> user — so
/// every tool call is tenant- and permission-scoped exactly as if that user typed it in chat.
///
/// <para><b>Autopilot vs confirm.</b> In <c>autopilot</c> mode write tools execute automatically.
/// In <c>confirm</c> mode the run stops at the first write and records a pending action for a human
/// to approve later in the app.</para>
///
/// Tenant isolation is applied by the shared <c>TenantIsolation</c> shadow-column filter (this entity
/// lives in the <c>Softaxis.AiAssistant.Domain</c> namespace), so reads/writes are auto tenant-scoped.
/// </summary>
public sealed class AiAutomationRule
{
    // EF ctor
    private AiAutomationRule() { }

    public AiAutomationRule(
        string name,
        string? description,
        string? agent,
        string instruction,
        Guid runAsUserId,
        string runAsUserName,
        string mode,
        AiRuleFrequency frequency,
        int? intervalMinutes,
        int? hourUtc,
        int minuteUtc,
        int? dayOfWeekUtc,
        bool notifyTelegram,
        bool enabled)
    {
        Id             = Guid.NewGuid();
        Name           = name.Trim();
        Description    = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Agent          = NormalizeAgent(agent);
        Instruction    = instruction.Trim();
        RunAsUserId    = runAsUserId;
        RunAsUserName  = runAsUserName.Trim();
        Mode           = NormalizeMode(mode);
        NotifyTelegram = notifyTelegram;
        Enabled        = enabled;
        SetSchedule(frequency, intervalMinutes, hourUtc, minuteUtc, dayOfWeekUtc);
    }

    public Guid    Id            { get; private set; }
    public string  Name          { get; private set; } = null!;
    public string? Description    { get; private set; }

    /// <summary>Named agent to scope tools to (e.g. "crm"); null = all tools the run-as user may use.</summary>
    public string? Agent         { get; private set; }

    /// <summary>The natural-language task the assistant performs on each run.</summary>
    public string  Instruction   { get; private set; } = null!;

    /// <summary>The user whose identity/permissions the rule runs under (token minted per run).</summary>
    public Guid    RunAsUserId   { get; private set; }
    public string  RunAsUserName { get; private set; } = null!;

    /// <summary>"autopilot" (writes run automatically) | "confirm" (writes queue for approval).</summary>
    public string  Mode          { get; private set; } = "confirm";

    // ── Schedule ──────────────────────────────────────────────────────────────
    public AiRuleFrequency Frequency       { get; private set; }
    public int?            IntervalMinutes { get; private set; }
    public int?            HourUtc         { get; private set; }
    public int             MinuteUtc       { get; private set; }
    public int?            DayOfWeekUtc    { get; private set; }

    // ── Delivery ──────────────────────────────────────────────────────────────
    /// <summary>When true, the run result is sent to the run-as user's linked Telegram chat (if any).</summary>
    public bool NotifyTelegram { get; private set; }

    public bool Enabled { get; private set; }

    // ── Telemetry ─────────────────────────────────────────────────────────────
    public DateTime? LastRunAt  { get; private set; }
    public DateTime? NextRunAt  { get; private set; }
    /// <summary>Last run outcome: "success" | "failed" | "pending_confirmation".</summary>
    public string?   LastStatus { get; private set; }
    public string?   LastError  { get; private set; }
    public int       RunCount   { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    // ── Behaviour ─────────────────────────────────────────────────────────────

    public void Update(
        string name,
        string? description,
        string? agent,
        string instruction,
        Guid runAsUserId,
        string runAsUserName,
        string mode,
        AiRuleFrequency frequency,
        int? intervalMinutes,
        int? hourUtc,
        int minuteUtc,
        int? dayOfWeekUtc,
        bool notifyTelegram)
    {
        Name           = name.Trim();
        Description    = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Agent          = NormalizeAgent(agent);
        Instruction    = instruction.Trim();
        RunAsUserId    = runAsUserId;
        RunAsUserName  = runAsUserName.Trim();
        Mode           = NormalizeMode(mode);
        NotifyTelegram = notifyTelegram;
        SetSchedule(frequency, intervalMinutes, hourUtc, minuteUtc, dayOfWeekUtc);
    }

    public void SetEnabled(bool enabled)
    {
        Enabled = enabled;
        if (enabled && NextRunAt is null)
            NextRunAt = ComputeNextRun(DateTime.UtcNow);
    }

    /// <summary>Record the outcome of a run and schedule the next one.</summary>
    public void RecordRun(string status, string? error, DateTime nowUtc)
    {
        LastRunAt  = nowUtc;
        LastStatus = status;
        LastError  = string.IsNullOrWhiteSpace(error) ? null : Truncate(error, 1000);
        RunCount++;
        NextRunAt  = Enabled ? ComputeNextRun(nowUtc) : null;
    }

    public void SetSchedule(
        AiRuleFrequency frequency, int? intervalMinutes, int? hourUtc, int minuteUtc, int? dayOfWeekUtc)
    {
        Frequency       = frequency;
        IntervalMinutes = frequency == AiRuleFrequency.Interval ? Math.Max(1, intervalMinutes ?? 60) : null;
        HourUtc         = frequency is AiRuleFrequency.Daily or AiRuleFrequency.Weekly ? Clamp(hourUtc ?? 0, 0, 23) : null;
        MinuteUtc       = Clamp(minuteUtc, 0, 59);
        DayOfWeekUtc    = frequency == AiRuleFrequency.Weekly ? Clamp(dayOfWeekUtc ?? 1, 0, 6) : null;
        NextRunAt       = Enabled ? ComputeNextRun(DateTime.UtcNow) : null;
    }

    /// <summary>Deterministic next fire time strictly after <paramref name="fromUtc"/>.</summary>
    public DateTime ComputeNextRun(DateTime fromUtc)
    {
        switch (Frequency)
        {
            case AiRuleFrequency.Interval:
                return fromUtc.AddMinutes(IntervalMinutes ?? 60);

            case AiRuleFrequency.Hourly:
            {
                var next = new DateTime(fromUtc.Year, fromUtc.Month, fromUtc.Day, fromUtc.Hour, MinuteUtc, 0, DateTimeKind.Utc);
                if (next <= fromUtc) next = next.AddHours(1);
                return next;
            }

            case AiRuleFrequency.Daily:
            {
                var next = new DateTime(fromUtc.Year, fromUtc.Month, fromUtc.Day, HourUtc ?? 0, MinuteUtc, 0, DateTimeKind.Utc);
                if (next <= fromUtc) next = next.AddDays(1);
                return next;
            }

            case AiRuleFrequency.Weekly:
            {
                var next = new DateTime(fromUtc.Year, fromUtc.Month, fromUtc.Day, HourUtc ?? 0, MinuteUtc, 0, DateTimeKind.Utc);
                var target = DayOfWeekUtc ?? 1;
                var delta = ((target - (int)next.DayOfWeek) % 7 + 7) % 7;
                next = next.AddDays(delta);
                if (next <= fromUtc) next = next.AddDays(7);
                return next;
            }

            default:
                return fromUtc.AddHours(1);
        }
    }

    private static string NormalizeMode(string? mode) =>
        string.Equals(mode?.Trim(), "autopilot", StringComparison.OrdinalIgnoreCase) ? "autopilot" : "confirm";

    private static string? NormalizeAgent(string? agent) =>
        string.IsNullOrWhiteSpace(agent) ? null : agent.Trim().ToLowerInvariant();

    private static int Clamp(int v, int min, int max) => v < min ? min : v > max ? max : v;

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}
