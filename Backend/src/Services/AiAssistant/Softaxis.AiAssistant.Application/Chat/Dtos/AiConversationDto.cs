namespace Softaxis.AiAssistant.Application.Chat.Dtos;

/// <summary>One persisted chat turn, as returned to the client.</summary>
public sealed record AiChatMessageDto(Guid Id, string Role, string Content, DateTime CreatedAt, bool UsedFallback = false);

/// <summary>
/// The current user's ongoing assistant conversation. <see cref="ConversationId"/> is null and
/// <see cref="Messages"/> empty when the user hasn't chatted yet.
/// </summary>
public sealed record AiConversationDto(Guid? ConversationId, IReadOnlyList<AiChatMessageDto> Messages);
