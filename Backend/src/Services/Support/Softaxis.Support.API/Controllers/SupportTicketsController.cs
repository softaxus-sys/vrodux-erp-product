using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Support.API.Authorization;
using Softaxis.Support.API.Controllers.Common;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Application.Tickets.Queries;

namespace Softaxis.Support.API.Controllers;

/// <summary>
/// Every tenant's contact point with Softaxis support, and the operator's own agent queue, in
/// one controller — the two sides share one resource (the ticket), just with different
/// permission requirements per action. Actions with NO [RequirePermission] are open to any
/// authenticated user regardless of tenant, the same posture as changing your own password —
/// raising a ticket or reading your own tenant's tickets needs no special grant. Agent-side
/// actions (queue, assign, status) require `support.tickets.*`, and the handlers additionally
/// require the caller's own tenant to be the configured Softaxis operator tenant.
/// </summary>
[ApiController][Route("api/support")][Authorize]
public sealed class SupportTicketsController(ISender sender) : SupportControllerBase
{
    // ── Any authenticated user, any tenant ──────────────────────────────────────

    [HttpPost("tickets")]
    public async Task<IActionResult> Create([FromBody] CreateTicketRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateTicketCommand(
            req.Subject, req.Category ?? "general", req.Priority ?? "medium", req.Message, req.Attachments), ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    [HttpGet("my-tickets")]
    public async Task<IActionResult> GetMyTickets([FromQuery] string? status, CancellationToken ct)
    {
        var result = await sender.Send(new GetMyTicketsQuery(status), ct);
        return OkOrError(result);
    }

    // Dual-access: an operator-tenant agent with `support.tickets.view` sees any ticket; anyone
    // else only their own tenant's — enforced inside the handler, not here.
    [HttpGet("tickets/{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetTicketByIdQuery(id), ct);
        return OkOrError(result);
    }

    // Dual-access reply — see AddTicketMessageHandler / TicketAccess.CanReply.
    [HttpPost("tickets/{id:guid}/messages")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddMessageRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new AddTicketMessageCommand(id, req.Body, req.Attachments), ct);
        return OkOrError(result);
    }

    // ── Softaxis support agents only (operator tenant + permission) ────────────

    [HttpGet("queue")]
    [RequirePermission("support.tickets.view")]
    public async Task<IActionResult> GetQueue(
        [FromQuery] string? status, [FromQuery] string? category, [FromQuery] Guid? assignedToUserId, CancellationToken ct)
    {
        var result = await sender.Send(new GetTicketQueueQuery(status, category, assignedToUserId), ct);
        return OkOrError(result);
    }

    [HttpGet("queue/summary")]
    [RequirePermission("support.tickets.view")]
    public async Task<IActionResult> GetQueueSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetSupportQueueSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("agents")]
    [RequirePermission("support.tickets.view")]
    public async Task<IActionResult> GetAgents(CancellationToken ct)
    {
        var result = await sender.Send(new GetSupportAgentsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPatch("tickets/{id:guid}/status")]
    [RequirePermission("support.tickets.edit")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeStatusRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ChangeTicketStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("tickets/{id:guid}/assign")]
    [RequirePermission("support.tickets.edit")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new AssignTicketCommand(id, req.AssignToUserId, req.AssignToUserName, req.Note), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("tickets/{id:guid}/priority")]
    [RequirePermission("support.tickets.edit")]
    public async Task<IActionResult> SetPriority(Guid id, [FromBody] SetPriorityRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new SetTicketPriorityCommand(id, req.Priority), ct);
        return NoContentOrError(result);
    }

    public sealed record CreateTicketRequest(string Subject, string? Category, string? Priority, string Message,
        IReadOnlyList<AttachmentInput>? Attachments = null);
    public sealed record AddMessageRequest(string Body, IReadOnlyList<AttachmentInput>? Attachments = null);
    public sealed record ChangeStatusRequest(string Status);
    public sealed record AssignRequest(Guid? AssignToUserId, string? AssignToUserName, string? Note);
    public sealed record SetPriorityRequest(string Priority);
}
