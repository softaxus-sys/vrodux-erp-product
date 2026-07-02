using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.Chat.Commands;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// The assistant chat endpoint. Any authenticated user may chat; the tools the assistant can use
/// are scoped to that user's permissions and tenant, so a low-access user simply gets less back.
/// </summary>
[ApiController]
[Route("api/ai/chat")]
[Authorize]
public sealed class AiChatController(ISender sender) : AiAssistantControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Send([FromBody] SendChatMessageCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
