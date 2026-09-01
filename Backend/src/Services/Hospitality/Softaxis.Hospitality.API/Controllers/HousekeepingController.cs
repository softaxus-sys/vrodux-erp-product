using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Housekeeping.Commands;
using Softaxis.Hospitality.Application.Housekeeping.Queries;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/housekeeping")][Authorize]
public sealed class HousekeepingController(ISender sender) : HospitalityControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetHousekeepingSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] string? taskType = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetHousekeepingTasksQuery(status, taskType, search, page, pageSize), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskReq req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateHousekeepingTaskCommand(
            req.RoomId, req.RoomNumber, req.TaskType, req.Priority, req.AssignedTo, req.Notes), ct);
        return CreatedOrError(result);
    }

    [HttpPatch("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new StartHousekeepingTaskCommand(id), ct);
        return OkOrError(result);
    }

    [HttpPatch("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CompleteHousekeepingTaskCommand(id), ct);
        return OkOrError(result);
    }

    [HttpPatch("{id:guid}/verify")]
    public async Task<IActionResult> Verify(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new VerifyHousekeepingTaskCommand(id), ct);
        return OkOrError(result);
    }

    public record CreateTaskReq(Guid RoomId, string RoomNumber, string TaskType, string Priority,
        string? AssignedTo, string? Notes);
}
