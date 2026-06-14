using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Application.Activities.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/activities")][Authorize]
public sealed class ActivitiesController(ISender sender) : CrmControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? relatedToType, [FromQuery] Guid? relatedToId,
        [FromQuery] bool? completed, [FromQuery] string? type, CancellationToken ct)
    {
        var result = await sender.Send(new GetActivitiesQuery(relatedToType, relatedToId, completed, type), ct);
        return OkOrError(result);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetActivitiesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateActivityCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateActivityRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateActivityCommand(id, req.Type, req.Subject, req.Description, req.DueDate, req.AssignedTo), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CompleteActivityCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new ReopenActivityCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteActivityCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdateActivityRequest(string Type, string Subject, string? Description, string? DueDate, string AssignedTo);
}
