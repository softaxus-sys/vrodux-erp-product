using Softaxis.AiAssistant.Application.Chat.Dtos;

namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>
/// Drives one assistant turn: loads the tenant's provider + key, builds the caller-permitted tool
/// set for the requested agent, then runs the tool-calling loop until a final answer. When the model
/// requests a WRITE tool, the loop stops and returns a pending action for the user to confirm.
/// Every tool runs as the current user, so all data access is tenant- and permission-scoped.
/// </summary>
public interface IAiOrchestrator
{
    Task<AiChatResponseDto> RunAsync(
        string message,
        IReadOnlyList<AiChatMessage> history,
        string? agent,
        CancellationToken ct);

    /// <summary>Executes a confirmed write action and summarises the outcome for the user.</summary>
    Task<AiChatResponseDto> ConfirmAsync(
        string toolName,
        string argumentsJson,
        CancellationToken ct);
}
