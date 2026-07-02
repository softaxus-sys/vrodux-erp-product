using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Authorization;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.Telegram.Commands;
using Softaxis.AiAssistant.Application.Telegram.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Per-user Telegram linking. Each user connects their own Telegram account (respecting their role);
/// registering the tenant bot's webhook is admin-only.
/// </summary>
[ApiController]
[Route("api/ai/telegram")]
[Authorize]
public sealed class TelegramController(ISender sender) : AiAssistantControllerBase
{
    /// <summary>Current user's link status + deep link.</summary>
    [HttpGet]
    public async Task<IActionResult> Status(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTelegramLinkStatusQuery(), ct));

    /// <summary>Generate (or refresh) a one-time link code + deep link for the current user.</summary>
    [HttpPost("link")]
    public async Task<IActionResult> Link(CancellationToken ct) =>
        OkOrError(await sender.Send(new GenerateTelegramLinkCommand(), ct));

    /// <summary>Disconnect the current user's Telegram.</summary>
    [HttpPost("unlink")]
    public async Task<IActionResult> Unlink(CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UnlinkTelegramCommand(), ct));

    /// <summary>Admin: register the tenant bot's webhook with Telegram. Returns the webhook URL.</summary>
    [HttpPost("register-webhook")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> RegisterWebhook(CancellationToken ct) =>
        OkOrError(await sender.Send(new RegisterTelegramWebhookCommand(), ct));
}
