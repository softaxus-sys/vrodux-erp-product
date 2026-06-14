using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Construction.API.Controllers.Common;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Application.Bidding.Queries;

namespace Softaxis.Construction.API.Controllers;

/// <summary>
/// CRM-linked construction bidding lifecycle: RFQs → Estimates → Contracts.
/// Each record references the core CRM Lead/Deal/Customer by ID (reuse, not duplication).
/// </summary>
[ApiController][Route("api/construction")][Authorize]
public sealed class ConstructionSalesController(ISender sender) : ConstructionControllerBase
{
    public sealed record StatusReq(string Status);

    [HttpGet("bidding/summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var result = await sender.Send(new GetBiddingSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── RFQs ──────────────────────────────────────────────────────────────────
    [HttpGet("rfqs")]
    public async Task<IActionResult> GetRfqs(CancellationToken ct)
    {
        var result = await sender.Send(new GetRfqsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("rfqs")]
    public async Task<IActionResult> CreateRfq([FromBody] CreateRfqCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("rfqs/{id:guid}/status")]
    public async Task<IActionResult> RfqStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new SetRfqStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("rfqs/{id:guid}")]
    public async Task<IActionResult> DeleteRfq(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteRfqCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Estimates ─────────────────────────────────────────────────────────────
    [HttpGet("estimates")]
    public async Task<IActionResult> GetEstimates(CancellationToken ct)
    {
        var result = await sender.Send(new GetEstimatesQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("estimates")]
    public async Task<IActionResult> CreateEstimate([FromBody] CreateEstimateCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("estimates/{id:guid}/status")]
    public async Task<IActionResult> EstStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new SetEstimateStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("estimates/{id:guid}")]
    public async Task<IActionResult> DeleteEstimate(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteEstimateCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Contracts ─────────────────────────────────────────────────────────────
    [HttpGet("contracts")]
    public async Task<IActionResult> GetContracts(CancellationToken ct)
    {
        var result = await sender.Send(new GetContractsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("contracts")]
    public async Task<IActionResult> CreateContract([FromBody] CreateContractCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("contracts/{id:guid}/status")]
    public async Task<IActionResult> ConStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new SetContractStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("contracts/{id:guid}")]
    public async Task<IActionResult> DeleteContract(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteContractCommand(id), ct);
        return NoContentOrError(result);
    }
}
