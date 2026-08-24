using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Chat.Commands;

/// <summary>Deletes the calling user's persisted conversation, starting them fresh.</summary>
public sealed record ClearMyConversationCommand : ICommand;
