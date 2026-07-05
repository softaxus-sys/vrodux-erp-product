using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.Application.Voice.Commands;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Anonymous inbound webhook for Vapi call events (status updates + end-of-call reports). The
/// tenant is resolved from the {inboundKey} in the URL and the delivery is authenticated by the
/// <c>x-vapi-secret</c> header (mirrors the Telegram webhook pattern). Always returns 200 so a
/// processing hiccup doesn't make Vapi retry forever.
/// </summary>
[ApiController]
[Route("api/ai/voice/webhook")]
[AllowAnonymous]
public sealed class AiVoiceWebhookController(ISender sender) : ControllerBase
{
    [HttpPost("{inboundKey}")]
    public async Task<IActionResult> Receive(string inboundKey, CancellationToken ct)
    {
        string body;
        using (var reader = new StreamReader(Request.Body))
            body = await reader.ReadToEndAsync(ct);

        var secret = Request.Headers["x-vapi-secret"].FirstOrDefault();

        try
        {
            await sender.Send(new ProcessVapiEventCommand(inboundKey, secret, body), ct);
        }
        catch
        {
            // Never surface an error to Vapi — the outcome is recoverable via GetCallAsync later.
        }
        return Ok();
    }
}
