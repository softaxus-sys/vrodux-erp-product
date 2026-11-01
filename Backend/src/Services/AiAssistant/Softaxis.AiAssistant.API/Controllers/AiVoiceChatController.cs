using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.AiAssistant.API.Controllers.Common;
using Softaxis.AiAssistant.Application.VoiceChat;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.API.Controllers;

/// <summary>
/// Talking to the assistant: a recording becomes text, a reply becomes audio. Any signed-in user who
/// can chat can use it; what it costs is decided by whose key serves the request (see VoiceAccessResolver).
/// </summary>
[ApiController]
[Route("api/ai/voice-chat")]
[Authorize]
public sealed class AiVoiceChatController(ISender sender) : AiAssistantControllerBase
{
    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetVoiceChatStatusQuery(), ct));

    [HttpPost("transcribe")]
    public async Task<IActionResult> Transcribe([FromBody] TranscribeSpeechCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPost("speak")]
    public async Task<IActionResult> Speak([FromBody] SynthesizeSpeechCommand cmd, CancellationToken ct)
    {
        var r = await sender.Send(cmd, ct);
        return FileOrError(r.IsSuccess
            ? Result.Success((r.Value.Audio, r.Value.ContentType))
            : Result.Failure<(byte[], string)>(r.Error));
    }
}
