using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.Chat.Commands;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// The assistant chat + confirm endpoints. Any authenticated user may chat; the tools the
/// assistant can use are scoped to that user's permissions and tenant.
/// </summary>
[ApiController]
[Route("api/ai")]
[Authorize]
public sealed class AiChatController(ISender sender) : AiAssistantControllerBase
{
    /// <summary>Send a message. May return a PendingAction the user must confirm.</summary>
    [HttpPost("chat")]
    public async Task<IActionResult> Send([FromBody] SendChatMessageCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>Confirm and run a write action previously proposed by a chat turn.</summary>
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmActionCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}
