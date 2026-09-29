using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.Settings;

namespace Softaxis.POS.API.Controllers;

/// <summary>Settings > FBR Integration (Pakistan): credentials, sandbox test, and the retry queue.</summary>
[Authorize]
[Route("api/pos/fbr")]
public sealed class FbrController(ISender sender) : BaseApiController(sender)
{
    /// <summary>GET /api/pos/fbr - settings (never the token) + queue status.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetFbrSettingsQuery(), ct));

    /// <summary>PUT /api/pos/fbr - save settings. Omit token to keep the stored one.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpPut]
    public async Task<IActionResult> Save([FromBody] SaveFbrSettingsCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>POST /api/pos/fbr/test - send a Rs 1 dummy invoice to the FBR sandbox.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpPost("test")]
    public async Task<IActionResult> Test(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new TestFbrConnectionCommand(), ct));

    /// <summary>POST /api/pos/fbr/retry?transactionId= - re-queue one (or all) failed submissions.</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpPost("retry")]
    public async Task<IActionResult> Retry([FromQuery] Guid? transactionId, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new RetryFbrCommand(transactionId), ct));
}
