using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Fixes.Commands;
using Softaxis.Seo.Application.Fixes.Queries;

namespace Softaxis.Seo.API.Controllers;

[ApiController]
[Route("api/seo")]
[Authorize]
public sealed class SeoFixesController(ISender sender) : SeoControllerBase
{
    [HttpGet("sites/{siteId:guid}/fixes")]
    [RequirePermission("seo.fixes.view")]
    public async Task<IActionResult> GetFixes(Guid siteId, [FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFixesQuery(siteId, status), ct));

    [HttpPost("sites/{siteId:guid}/scan")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> RunScanNow(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunScanNowCommand(siteId), ct));

    public sealed record EditFixRequest(string? EditedValueJson);

    [HttpPost("fixes/{id:guid}/approve")]
    [RequirePermission("seo.fixes.edit")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] EditFixRequest? req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApproveFixCommand(id, req?.EditedValueJson), ct));

    [HttpPost("fixes/{id:guid}/reject")]
    [RequirePermission("seo.fixes.edit")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RejectFixCommand(id), ct));
}
