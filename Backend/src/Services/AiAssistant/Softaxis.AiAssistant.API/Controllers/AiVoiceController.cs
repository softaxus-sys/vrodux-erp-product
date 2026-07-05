using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Authorization;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.Voice.Commands;
using Softaxis.AiAssistant.Application.Voice.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Tenant AI voice-agent configuration (BYO Vapi key, caller number, persona, guardrails) and the
/// outbound-call log. Admin-only, same surface as the AI settings. The Vapi key is write-only.
/// </summary>
[ApiController]
[Route("api/ai/voice")]
[Authorize]
public sealed class AiVoiceController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet("settings")]
    [RequirePermission("settings.ai.view")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetVoiceSettingsQuery(), ct));

    [HttpPut("settings")]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateVoiceSettingsCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpGet("calls")]
    [RequirePermission("settings.ai.view")]
    public async Task<IActionResult> GetCalls([FromQuery] int take = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetScheduledCallsQuery(take), ct));
}
