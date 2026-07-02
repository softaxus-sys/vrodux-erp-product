using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.Agents.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>Lists the named agents the current user can talk to (call-by-name targets).</summary>
[ApiController]
[Route("api/ai/agents")]
[Authorize]
public sealed class AiAgentsController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAgentsQuery(), ct));
}
