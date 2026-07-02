using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// Executes a single automation rule: mints a token for the rule's run-as user, runs the assistant
/// under that identity (so tenant isolation + RBAC hold), records an <see cref="AiAutomationRun"/>,
/// updates the rule's telemetry/next-run, and optionally delivers the result to Telegram.
/// Shared by the background scheduler and the manual "run now" endpoint.
/// </summary>
public interface IAiAutomationRunner
{
    /// <param name="triggerContext">
    /// Optional context appended to the rule's instruction (e.g. the business event that fired an event
    /// rule), so the model knows what triggered this run.
    /// </param>
    Task<AiAutomationRun> RunAsync(
        AiAutomationRule rule, Guid tenantId, string triggeredBy, CancellationToken ct,
        string? triggerContext = null);
}
