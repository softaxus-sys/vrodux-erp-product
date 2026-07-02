namespace Softaxis.AiAssistant.Application.Chat.Dtos;

/// <summary>
/// A write action the assistant wants to perform, held back for the user to confirm. The client
/// echoes <see cref="ToolName"/> + <see cref="ArgumentsJson"/> to POST /api/ai/confirm to run it.
/// </summary>
public sealed record PendingActionDto(
    string Id,
    string ToolName,
    string ArgumentsJson,
    string Summary);

/// <summary>
/// The outcome of one autonomous (scheduled) assistant run. <see cref="Status"/> is
/// "success" | "failed" | "pending_confirmation"; when pending, <see cref="Pending"/> holds the
/// write action a human must approve.
/// </summary>
public sealed record AiAutonomousResult(
    string Status,
    string Reply,
    IReadOnlyList<string> ToolsUsed,
    PendingActionDto? Pending,
    string? Error);

/// <summary>The assistant's reply to a chat turn.</summary>
public sealed record AiChatResponseDto(
    string Reply,
    IReadOnlyList<string> ToolsUsed,
    string Provider,
    string Model,
    PendingActionDto? PendingAction = null,
    string? Agent = null);
