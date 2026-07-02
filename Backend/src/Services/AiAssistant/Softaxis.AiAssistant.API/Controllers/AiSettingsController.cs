using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Authorization;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.AiSettings.Commands;
using Softaxis.AiAssistant.Application.AiSettings.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Tenant AI configuration (provider, BYO API key, model, feature toggles, tier). Admin-only.
/// The API key is write-only — it is never returned to the client.
/// </summary>
[ApiController]
[Route("api/ai/settings")]
[Authorize]
public sealed class AiSettingsController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet]
    [RequirePermission("settings.ai.view")]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAiSettingsQuery(), ct));

    [HttpPut]
    [RequirePermission("settings.ai.edit")]
    public async Task<IActionResult> Update([FromBody] UpdateAiSettingsCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
