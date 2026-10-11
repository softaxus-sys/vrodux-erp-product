using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Manufacturing.API.Authorization;
using Softaxis.Manufacturing.API.Controllers.Common;
using Softaxis.Manufacturing.Application.Planning;

namespace Softaxis.Manufacturing.API.Controllers;

/// <summary>Read-only planning views over production orders.</summary>
[Route("api/manufacturing/planning")][Authorize]
[RequirePermission("manufacturing.planning.view")]
public sealed class PlanningController(ISender sender) : ManufacturingControllerBase
{
    [HttpGet("material-requirements")]
    public async Task<IActionResult> MaterialRequirements(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMaterialRequirementsQuery(), ct));

    [HttpGet("yield")]
    public async Task<IActionResult> Yield([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetProductionYieldQuery(from, to), ct));

    [HttpGet("wip")]
    public async Task<IActionResult> Wip(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWipQuery(), ct));

    [HttpGet("work-centre-load")]
    public async Task<IActionResult> WorkCentreLoad(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWorkCentreLoadQuery(), ct));

    [HttpGet("schedule")]
    public async Task<IActionResult> Schedule(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetScheduleQuery(), ct));
}
