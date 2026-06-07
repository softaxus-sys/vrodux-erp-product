using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.Transactions.Commands.CreateSale;
using Softaxis.POS.Application.Transactions.Commands.HoldTransaction;
using Softaxis.POS.Application.Transactions.Commands.RecallTransaction;
using Softaxis.POS.Application.Transactions.Commands.RefundTransaction;
using Softaxis.POS.Application.Transactions.Commands.VoidTransaction;
using Softaxis.POS.Application.Transactions.Queries.GetTransactionById;
using Softaxis.POS.Application.Transactions.Queries.GetTransactions;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class TransactionsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get paginated transaction list with filters.</summary>
    [HttpGet]
    public async Task<IActionResult> GetTransactions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? sessionId = null,
        [FromQuery] Guid? cashierId = null,
        [FromQuery] Guid? customerId = null,
        [FromQuery] string? type = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetTransactionsQuery(page, pageSize, sessionId, cashierId, customerId, type, status, from, to, search), ct));

    /// <summary>Get full transaction detail (with line items and payments).</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetTransactionByIdQuery(id), ct));

    /// <summary>Create and complete a sale transaction.</summary>
    [HttpPost("sale")]
    public async Task<IActionResult> CreateSale([FromBody] CreateSaleCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    /// <summary>Void a completed transaction.</summary>
    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new VoidTransactionCommand(id, req.Reason), ct));

    /// <summary>Refund (partial or full) a completed transaction.</summary>
    [HttpPost("{id:guid}/refund")]
    public async Task<IActionResult> Refund(Guid id, [FromBody] RefundBody body, CancellationToken ct = default)
        => HandleResult(await Sender.Send(
               new RefundTransactionCommand(id, body.SessionId, body.LineItems, body.Payments, body.Reason),
               ct), successCode: 201);

    /// <summary>Hold (park) a transaction for later recall.</summary>
    [HttpPost("hold")]
    public async Task<IActionResult> Hold([FromBody] HoldTransactionCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    /// <summary>Recall a previously held transaction.</summary>
    [HttpPost("held/{id:guid}/recall")]
    public async Task<IActionResult> Recall(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new RecallTransactionCommand(id), ct));
}

public sealed record VoidRequest(string? Reason);

public sealed record RefundBody(
    Guid                           SessionId,
    IReadOnlyList<LineItemRequest> LineItems,
    IReadOnlyList<PaymentRequest>  Payments,
    string?                        Reason);
