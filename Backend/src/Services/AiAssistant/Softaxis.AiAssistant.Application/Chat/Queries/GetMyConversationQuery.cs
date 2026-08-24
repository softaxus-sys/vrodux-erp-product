using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Chat.Queries;

/// <summary>Fetches the calling user's persisted chat history so it survives page navigation.</summary>
public sealed record GetMyConversationQuery : IQuery<AiConversationDto>;
