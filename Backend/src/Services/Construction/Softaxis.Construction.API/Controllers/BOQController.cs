using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Construction.API.Controllers.Common;
using Softaxis.Construction.Application.Boqs.Queries;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/boqs")][Authorize]
public sealed class BOQController(ISender sender) : ConstructionControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetBoqsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetBoqsQuery(), ct);
        return OkOrError(result);
    }
}
