namespace Softaxis.AiAssistant.Application.Chat.Dtos;

/// <summary>The assistant's reply to a chat turn, plus which tools it invoked and the model used.</summary>
public sealed record AiChatResponseDto(
    string Reply,
    IReadOnlyList<string> ToolsUsed,
    string Provider,
    string Model);
