using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Deals.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/deals")][Authorize]
public sealed class PipelineController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    [RequireAnyPermission("crm.pipeline.view", "crm.pipeline-team.view", "crm.pipeline-assigned.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetDealsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequireAnyPermission("crm.pipeline.view", "crm.pipeline-team.view", "crm.pipeline-assigned.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? customerId, CancellationToken ct)
    {
        var result = await sender.Send(new GetDealsQuery(customerId), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequireAnyPermission("crm.pipeline.view", "crm.pipeline-team.view", "crm.pipeline-assigned.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetDealByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("crm.pipeline.create")]
    public async Task<IActionResult> Create([FromBody] CreateDealCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    [HttpPut("{id:guid}")]
    [RequireAnyPermission("crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDealRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateDealCommand(id, req.Title, req.Company, req.Value, req.Stage,
            req.Priority, req.Probability, req.ExpectedCloseDate, req.AssignedTo, req.Source, req.Industry,
            req.Description, req.NextAction, req.NextActionDate, req.Tags, req.ForecastCategory, req.CustomerId,
            req.AssignedToUserId), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/stage")]
    [RequireAnyPermission("crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit")]
    public async Task<IActionResult> MoveStage(Guid id, [FromBody] StageReq req, CancellationToken ct)
    {
        var result = await sender.Send(new MoveDealStageCommand(id, req.Stage, req.Probability, req.ForecastCategory, req.LossReason), ct);
        return NoContentOrError(result);
    }

    // No crm.pipeline.delete key seeded — gate delete on the nearest key (edit).
    [HttpDelete("{id:guid}")]
    [RequireAnyPermission("crm.pipeline.edit", "crm.pipeline-team.edit", "crm.pipeline-assigned.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteDealCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdateDealRequest(string Title, string Company, decimal Value, string Stage, string Priority,
        int Probability, string ExpectedCloseDate, string AssignedTo, string Source, string Industry, string Description,
        string? NextAction, string? NextActionDate, List<string>? Tags, string? ForecastCategory = null,
        Guid? CustomerId = null, Guid? AssignedToUserId = null);
    public sealed record StageReq(string Stage, int Probability, string? ForecastCategory = null, string? LossReason = null);
}
