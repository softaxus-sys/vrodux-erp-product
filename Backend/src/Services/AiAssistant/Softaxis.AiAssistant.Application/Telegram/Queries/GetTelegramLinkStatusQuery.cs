using Softaxis.AiAssistant.Application.Telegram.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Telegram.Queries;

/// <summary>Returns the current user's Telegram link status (any authenticated user).</summary>
public sealed record GetTelegramLinkStatusQuery : IQuery<TelegramLinkStatusDto>;
