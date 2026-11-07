using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.PlatformAi.Commands;
using Softaxis.AiAssistant.Application.PlatformAi.Queries;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// The platform-wide AI that serves every workspace without its own key (and the voice settings
/// that go with it). Super admin only. Keys are write-only.
/// </summary>
[ApiController]
[Route("api/admin/ai-platform")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class AiPlatformAdminController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPlatformAiQuery(), ct));

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdatePlatformAiCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPost("test")]
    public async Task<IActionResult> Test(CancellationToken ct) =>
        OkOrError(await sender.Send(new TestPlatformAiCommand(), ct));

    [HttpPost("test-voice")]
    public async Task<IActionResult> TestVoice(CancellationToken ct) =>
        OkOrError(await sender.Send(new TestPlatformVoiceCommand(), ct));

    [HttpGet("usage")]
    public async Task<IActionResult> Usage([FromQuery] string? month, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPlatformAiUsageQuery(month), ct));
}
