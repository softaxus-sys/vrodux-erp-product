namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// One execution of an <see cref="AiAutomationRule"/> — kept as an audit/history trail the tenant can
/// review. A run ends in "success", "failed", or (confirm-mode rules that hit a write) in
/// "pending_confirmation", in which case <see cref="PendingToolName"/>/<see cref="PendingArgumentsJson"/>
/// hold the queued action for a human to approve. Tenant-isolated like the rule.
/// </summary>
public sealed class AiAutomationRun
{
    // EF ctor
    private AiAutomationRun() { }

    public AiAutomationRun(Guid ruleId, string ruleName, Guid runAsUserId, string triggeredBy)
    {
        Id          = Guid.NewGuid();
        RuleId      = ruleId;
        RuleName    = ruleName;
        RunAsUserId = runAsUserId;
        TriggeredBy = triggeredBy; // "schedule" | "manual"
        Status      = "running";
        StartedAt   = DateTime.UtcNow;
    }

    public Guid   Id          { get; private set; }
    public Guid   RuleId      { get; private set; }
    public string RuleName    { get; private set; } = null!;
    public Guid   RunAsUserId { get; private set; }
    public string TriggeredBy { get; private set; } = "schedule";

    /// <summary>"running" | "success" | "failed" | "pending_confirmation".</summary>
    public string  Status   { get; private set; } = "running";
    public string? Summary  { get; private set; }
    public string? ToolsUsed { get; private set; }
    public string? Error    { get; private set; }

    // ── Confirm-mode pending action ───────────────────────────────────────────
    public string? PendingToolName      { get; private set; }
    public string? PendingArgumentsJson { get; private set; }

    public DateTime  StartedAt   { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public DateTime  CreatedAt   { get; private set; }

    public bool IsPending => Status == "pending_confirmation";

    public void Complete(string status, string? summary, IReadOnlyList<string>? toolsUsed, string? error)
    {
        Status      = status;
        Summary     = Truncate(summary, 4000);
        ToolsUsed   = toolsUsed is { Count: > 0 } ? string.Join(",", toolsUsed) : null;
        Error       = Truncate(error, 1000);
        CompletedAt = DateTime.UtcNow;
    }

    /// <summary>Confirm-mode: the run reached a write tool that needs human approval.</summary>
    public void SetPending(string toolName, string argumentsJson, string? summary, IReadOnlyList<string>? toolsUsed)
    {
        Status               = "pending_confirmation";
        PendingToolName      = toolName;
        PendingArgumentsJson = argumentsJson;
        Summary              = Truncate(summary, 4000);
        ToolsUsed            = toolsUsed is { Count: > 0 } ? string.Join(",", toolsUsed) : null;
        CompletedAt          = DateTime.UtcNow;
    }

    /// <summary>Resolve a previously-pending run once its queued action has been approved (or rejected).</summary>
    public void Resolve(string status, string? summary, string? error)
    {
        Status               = status;
        Summary              = Truncate(summary, 4000) ?? Summary;
        Error                = Truncate(error, 1000);
        PendingToolName      = null;
        PendingArgumentsJson = null;
        CompletedAt          = DateTime.UtcNow;
    }

    private static string? Truncate(string? s, int max) =>
        string.IsNullOrEmpty(s) ? null : s.Length <= max ? s : s[..max];
}
