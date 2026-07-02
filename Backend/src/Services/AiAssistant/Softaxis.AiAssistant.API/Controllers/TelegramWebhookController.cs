using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.Application.Telegram.Commands;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Anonymous inbound webhook for Telegram. The tenant is resolved from the {inboundKey} in the URL
/// (there is no authenticated user here). Always returns 200 so Telegram doesn't retry.
/// </summary>
[ApiController]
[Route("api/ai/telegram/webhook")]
[AllowAnonymous]
public sealed class TelegramWebhookController(ISender sender) : ControllerBase
{
    [HttpPost("{inboundKey}")]
    public async Task<IActionResult> Receive(string inboundKey, CancellationToken ct)
    {
        string body;
        using (var reader = new StreamReader(Request.Body))
            body = await reader.ReadToEndAsync(ct);

        var baseUrl = $"{Request.Scheme}://{Request.Host.Value}";

        try
        {
            await sender.Send(new ProcessTelegramUpdateCommand(inboundKey, body, baseUrl), ct);
        }
        catch
        {
            // Never surface an error to Telegram — it would retry the delivery.
        }
        return Ok();
    }
}
