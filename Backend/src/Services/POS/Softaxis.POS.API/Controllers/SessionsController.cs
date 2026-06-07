using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.Sessions.Commands.CloseSession;
using Softaxis.POS.Application.Sessions.Commands.OpenSession;
using Softaxis.POS.Application.Sessions.Commands.RecordCashMovement;
using Softaxis.POS.Application.Sessions.Commands.SuspendSession;
using Softaxis.POS.Application.Sessions.Queries.GetActiveSessions;
using Softaxis.POS.Application.Sessions.Queries.GetCashMovements;
using Softaxis.POS.Application.Sessions.Queries.GetSessionById;
using Softaxis.POS.Application.Transactions.Queries.GetTransactions;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class SessionsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>List all currently active (open) sessions.</summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActive(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetActiveSessionsQuery(), ct));

    /// <summary>Get a specific session by ID.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetSessionByIdQuery(id), ct));

    /// <summary>Open a new POS session (start of shift).</summary>
    [HttpPost("open")]
    public async Task<IActionResult> Open([FromBody] OpenSessionCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    /// <summary>Close a POS session (end of shift).</summary>
    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id, [FromBody] CloseSessionRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new CloseSessionCommand(id, req.ClosingCash, req.Notes), ct));

    /// <summary>Suspend a session temporarily.</summary>
    [HttpPost("{id:guid}/suspend")]
    public async Task<IActionResult> Suspend(Guid id, [FromBody] SuspendSessionRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new SuspendSessionCommand(id, req.Notes), ct));

    /// <summary>Get all transactions in a session.</summary>
    [HttpGet("{id:guid}/transactions")]
    public async Task<IActionResult> GetTransactions(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetTransactionsQuery(page, pageSize, SessionId: id), ct));

    /// <summary>Record a manual cash drawer movement (pay-in / pay-out).</summary>
    [HttpPost("{id:guid}/cash-movement")]
    public async Task<IActionResult> RecordCashMovement(
        Guid id, [FromBody] CashMovementRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new RecordCashMovementCommand(id, req.Type, req.Amount, req.Reason), ct), successCode: 201);

    /// <summary>List the cash movements (pay-in / pay-out) recorded in a session.</summary>
    [HttpGet("{id:guid}/cash-movements")]
    public async Task<IActionResult> GetCashMovements(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCashMovementsQuery(id), ct));
}

public sealed record CloseSessionRequest(decimal ClosingCash, string? Notes);
public sealed record SuspendSessionRequest(string? Notes);
public sealed record CashMovementRequest(string Type, decimal Amount, string Reason);
