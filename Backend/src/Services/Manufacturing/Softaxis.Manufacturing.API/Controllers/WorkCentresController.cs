using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Manufacturing.API.Authorization;
using Softaxis.Manufacturing.API.Controllers.Common;
using Softaxis.Manufacturing.Application.WorkCentres;

namespace Softaxis.Manufacturing.API.Controllers;

/// <summary>
/// Work centres have their own permission group. Reading the list is also open to anyone who
/// can see BOMs or orders, because both screens show and pick work centres.
/// </summary>
[Route("api/manufacturing/work-centres")][Authorize]
public sealed class WorkCentresController(ISender sender) : ManufacturingControllerBase
{
    [HttpGet]
    [RequirePermission("manufacturing.work-centres.view", "manufacturing.boms.view", "manufacturing.orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetWorkCentresQuery(activeOnly), ct));

    [HttpPost]
    [RequirePermission("manufacturing.work-centres.create")]
    public async Task<IActionResult> Create([FromBody] UpsertRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateWorkCentreCommand(
            req.Name, req.Code, req.LabourRatePerHour, req.OverheadRatePerHour, req.CapacityHoursPerDay), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("manufacturing.work-centres.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateWorkCentreCommand(
            id, req.Name, req.Code, req.LabourRatePerHour, req.OverheadRatePerHour, req.IsActive, req.CapacityHoursPerDay), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("manufacturing.work-centres.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteWorkCentreCommand(id), ct));

    public sealed record UpsertRequest(
        string Name, string? Code, decimal LabourRatePerHour, decimal OverheadRatePerHour, bool IsActive = true,
        decimal CapacityHoursPerDay = 8);
}
