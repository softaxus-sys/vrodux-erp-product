using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Application.B2B.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// B2B Services pack: Proposals → Service Contracts (AMC/SLA/Retainer) → Support Tickets.
/// Customers are CRM customers, opportunities are CRM deals — reuse, not duplication.
/// </summary>
[ApiController][Route("api/b2b")][Authorize]
public sealed class B2BController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var result = await sender.Send(new GetB2BSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── Proposals ─────────────────────────────────────────────────────────────
    [HttpGet("proposals")]
    public async Task<IActionResult> GetProposals(CancellationToken ct)
    {
        var result = await sender.Send(new GetProposalsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("proposals")]
    public async Task<IActionResult> CreateProposal([FromBody] CreateProposalCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("proposals/{id:guid}/status")]
    public async Task<IActionResult> ProposalStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateProposalStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("proposals/{id:guid}")]
    public async Task<IActionResult> DeleteProposal(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteProposalCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Service Contracts ─────────────────────────────────────────────────────
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
    public async Task<IActionResult> ContractStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateContractStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("contracts/{id:guid}")]
    public async Task<IActionResult> DeleteContract(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteContractCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Support Tickets ───────────────────────────────────────────────────────
    [HttpGet("tickets")]
    public async Task<IActionResult> GetTickets(CancellationToken ct)
    {
        var result = await sender.Send(new GetTicketsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("tickets")]
    public async Task<IActionResult> CreateTicket([FromBody] CreateTicketCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPost("tickets/{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveReq r, CancellationToken ct)
    {
        var result = await sender.Send(new ResolveTicketCommand(id, r.Resolution), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("tickets/{id:guid}/status")]
    public async Task<IActionResult> TicketStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateTicketStatusCommand(id, r.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("tickets/{id:guid}")]
    public async Task<IActionResult> DeleteTicket(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteTicketCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record ResolveReq(string? Resolution);
    public sealed record StatusReq(string Status);
}
