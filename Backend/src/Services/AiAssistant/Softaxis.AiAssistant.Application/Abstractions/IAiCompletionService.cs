namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// A single structured completion using the current tenant's configured AI provider/model (BYO-key,
/// the same <c>TenantAiSettings</c> the interactive orchestrator reads) — no tool-calling loop, no
/// conversation history. For batch/background work that needs "just generate this with whatever the
/// tenant has configured," not an agentic multi-step run — e.g. the SEO module's bulk issue analysis.
/// See <see cref="IAiOrchestrator.RunAutonomousAsync"/> for the tool-calling equivalent.
/// </summary>
public interface IAiCompletionService
{
    Task<string> CompleteAsync(string systemPrompt, string userPrompt, CancellationToken ct = default);
}
