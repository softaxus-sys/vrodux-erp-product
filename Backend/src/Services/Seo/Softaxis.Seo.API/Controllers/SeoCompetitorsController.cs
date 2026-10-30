using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Seo.API.Authorization;
using Softaxis.Seo.API.Controllers.Common;
using Softaxis.Seo.Application.Competitors;

namespace Softaxis.Seo.API.Controllers;

/// <summary>Compare a website against up to five competitors: what they cover that it does not, and a 30-day plan to close the gap.</summary>
[ApiController]
[Route("api/seo")]
[Authorize]
public sealed class SeoCompetitorsController(ISender sender) : SeoControllerBase
{
    [HttpGet("sites/{siteId:guid}/competitors")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Overview(Guid siteId, CancellationToken ct) => OkOrError(await sender.Send(new GetCompetitorsQuery(siteId), ct));

    public sealed record AddRequest(string Domain);

    [HttpPost("sites/{siteId:guid}/competitors")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Add(Guid siteId, [FromBody] AddRequest r, CancellationToken ct) => OkOrError(await sender.Send(new AddCompetitorCommand(siteId, r.Domain), ct));

    [HttpDelete("competitors/{id:guid}")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new RemoveCompetitorCommand(id), ct));

    public sealed record StartRequest(int? LocationCode);

    [HttpPost("sites/{siteId:guid}/competitor-scans")]
    [RequirePermission("seo.sites.edit")]
    public async Task<IActionResult> Start(Guid siteId, [FromBody] StartRequest? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new StartCompetitorScanCommand(siteId, r?.LocationCode), ct));

    [HttpGet("sites/{siteId:guid}/competitor-scans")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Scans(Guid siteId, CancellationToken ct) => OkOrError(await sender.Send(new GetCompetitorScansQuery(siteId), ct));

    [HttpGet("competitor-scans/{id:guid}")]
    [RequirePermission("seo.sites.view")]
    public async Task<IActionResult> Scan(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetCompetitorScanQuery(id), ct));

    [HttpPost("plan-items/{id:guid}/draft")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> Draft(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new DraftPlanItemCommand(id), ct));

    [HttpPost("plan-items/{id:guid}/skip")]
    [RequirePermission("seo.content.edit")]
    public async Task<IActionResult> Skip(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new SkipPlanItemCommand(id), ct));
}
