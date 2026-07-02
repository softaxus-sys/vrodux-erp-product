using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.AiSettings.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// The tenant's AI capabilities (tier flags + which features are on). Available to ANY authenticated
/// user — it carries no secrets — so non-admin UI (chat voice button, automations visibility) can gate
/// itself. Contrast with <see cref="AiSettingsController"/>, which is admin-only and exposes config.
/// </summary>
[ApiController]
[Route("api/ai/capabilities")]
[Authorize]
public sealed class AiCapabilitiesController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAiCapabilitiesQuery(), ct));
}
