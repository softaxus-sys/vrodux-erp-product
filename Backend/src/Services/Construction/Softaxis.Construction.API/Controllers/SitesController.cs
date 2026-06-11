using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Construction.API.Controllers.Common;
using Softaxis.Construction.Application.Sites.Queries;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/sites")][Authorize]
public sealed class SitesController(ISender sender) : ConstructionControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetSitesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetSitesQuery(), ct);
        return OkOrError(result);
    }
}
