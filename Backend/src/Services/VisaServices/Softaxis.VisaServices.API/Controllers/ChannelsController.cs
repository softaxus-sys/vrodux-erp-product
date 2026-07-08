using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.VisaServices.API.Authorization;
using Softaxis.VisaServices.API.Controllers.Common;
using Softaxis.VisaServices.Application.Channels.Commands;
using Softaxis.VisaServices.Application.Channels.Queries;

namespace Softaxis.VisaServices.API.Controllers;

[ApiController][Route("api/visa")][Authorize]
public sealed class ChannelsController(ISender sender) : VisaControllerBase
{
    // ── Channels catalogue + connection ───────────────────────────────────────
    [HttpGet("channels")]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetChannels(CancellationToken ct)
    {
        var result = await sender.Send(new GetChannelsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("channels/{channel}/connect")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> Connect(string channel, [FromBody] ConnectRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ConnectChannelCommand(channel, req.EstablishmentCard, req.AccountRef, req.Secret), ct);
        return NoContentOrError(result);
    }

    [HttpPost("channels/{channel}/disconnect")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> Disconnect(string channel, CancellationToken ct)
    {
        var result = await sender.Send(new DisconnectChannelCommand(channel), ct);
        return NoContentOrError(result);
    }

    // ── Government submissions (per case) ──────────────────────────────────────
    [HttpGet("cases/{caseId:guid}/submissions")]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetSubmissions(Guid caseId, CancellationToken ct)
    {
        var result = await sender.Send(new GetCaseSubmissionsQuery(caseId), ct);
        return OkOrError(result);
    }

    [HttpPost("cases/{caseId:guid}/submissions")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> CreateSubmission(Guid caseId, [FromBody] CreateSubmissionRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateSubmissionCommand(caseId, req.Channel, req.SubmissionType,
            req.ExternalReference, req.Notes, req.ByName ?? User.Identity?.Name ?? ""), ct);
        return OkOrError(result);
    }

    [HttpPut("cases/{caseId:guid}/submissions/{submissionId:guid}")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> UpdateSubmission(Guid caseId, Guid submissionId, [FromBody] UpdateSubmissionRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateSubmissionStatusCommand(caseId, submissionId, req.Status,
            req.ExternalReference, req.Notes, req.ByName ?? User.Identity?.Name ?? ""), ct);
        return NoContentOrError(result);
    }

    public sealed record ConnectRequest(string? EstablishmentCard, string? AccountRef, string? Secret);
    public sealed record CreateSubmissionRequest(string Channel, string SubmissionType, string? ExternalReference, string? Notes, string? ByName);
    public sealed record UpdateSubmissionRequest(string Status, string? ExternalReference, string? Notes, string? ByName);
}
