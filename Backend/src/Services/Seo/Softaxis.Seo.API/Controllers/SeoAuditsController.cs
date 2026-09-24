using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Audits.Queries;

namespace Softaxis.Seo.API.Controllers;

[ApiController]
[Route("api/seo/sites/{siteId:guid}")]
[Authorize]
public sealed class SeoAuditsController(ISender sender) : SeoControllerBase
{
    [HttpGet("audits")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> GetAudits(Guid siteId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetAuditsQuery(siteId), ct));

    [HttpGet("issues")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> GetIssues(Guid siteId, [FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetIssuesQuery(siteId, status), ct));
}
