using Softaxis.AiAssistant.Application.Telegram.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Telegram.Commands;

/// <summary>Creates (or refreshes) the current user's one-time link code and returns the deep link.</summary>
public sealed record GenerateTelegramLinkCommand : ICommand<TelegramLinkStatusDto>;

/// <summary>Disconnects the current user's Telegram account.</summary>
public sealed record UnlinkTelegramCommand : ICommand;

/// <summary>
/// Admin: registers the tenant bot's webhook with Telegram so inbound messages reach the ERP.
/// Returns the registered webhook URL. Requires the bot token + inbound key to be configured.
/// </summary>
public sealed record RegisterTelegramWebhookCommand : ICommand<string>;

/// <summary>
/// Processes one inbound Telegram update (anonymous webhook). Resolves the tenant from the inbound
/// key, then either completes a "/start &lt;code&gt;" link or answers the linked user's message.
/// </summary>
public sealed record ProcessTelegramUpdateCommand(string InboundKey, string RawUpdateJson, string BaseUrl) : ICommand;
