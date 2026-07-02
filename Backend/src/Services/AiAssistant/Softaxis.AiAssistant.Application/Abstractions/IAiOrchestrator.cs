using Softaxis.AiAssistant.Application.Chat.Dtos;

namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// Drives one assistant turn: loads the tenant's provider + key, builds the system prompt and
/// the caller-permitted tool set for the requested agent, then runs the tool-calling loop
/// (model → execute tools → feed results back → repeat) until the model returns a final answer.
/// Every tool runs as the current user, so all data access is tenant- and permission-scoped.
/// </summary>
public interface IAiOrchestrator
{
    Task<AiChatResponseDto> RunAsync(
        string message,
        IReadOnlyList<AiChatMessage> history,
        string? agent,
        CancellationToken ct);
}
