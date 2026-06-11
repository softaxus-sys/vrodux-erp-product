using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Deals.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/deals")][Authorize]
public sealed class PipelineController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetDealsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetDealsQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetDealByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDealCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDealRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateDealCommand(id, req.Title, req.Company, req.Value, req.Stage,
            req.Priority, req.Probability, req.ExpectedCloseDate, req.AssignedTo, req.Source, req.Industry,
            req.Description, req.NextAction, req.NextActionDate, req.Tags), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/stage")]
    public async Task<IActionResult> MoveStage(Guid id, [FromBody] StageReq req, CancellationToken ct)
    {
        var result = await sender.Send(new MoveDealStageCommand(id, req.Stage, req.Probability), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteDealCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdateDealRequest(string Title, string Company, decimal Value, string Stage, string Priority,
        int Probability, string ExpectedCloseDate, string AssignedTo, string Source, string Industry, string Description,
        string? NextAction, string? NextActionDate, List<string>? Tags);
    public sealed record StageReq(string Stage, int Probability);
}
