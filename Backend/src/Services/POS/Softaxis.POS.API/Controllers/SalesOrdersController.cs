using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.SalesOrders.Commands.CreateSalesOrder;
using Softaxis.POS.Application.SalesOrders.Commands.DeleteSalesOrder;
using Softaxis.POS.Application.SalesOrders.Commands.UpdateSalesOrder;
using Softaxis.POS.Application.SalesOrders.Queries.GetSalesOrderById;
using Softaxis.POS.Application.SalesOrders.Queries.GetSalesOrders;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/sales-orders")]
[Tags("SalesOrders")]
public sealed class SalesOrdersController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/sales-orders ─────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status     = null,
        [FromQuery] Guid?   customerId = null,
        [FromQuery] string? from       = null,
        [FromQuery] string? to         = null,
        [FromQuery] string? search     = null,
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 25,
        CancellationToken ct = default) =>
        HandleResult(await Sender.Send(
            new GetSalesOrdersQuery(status, customerId, from, to, search, page, pageSize), ct));

    // ── GET /api/sales-orders/{id} ────────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetSalesOrderByIdQuery(id), ct));

    // ── POST /api/sales-orders ────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSORequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new CreateSalesOrderCommand(
            req.CustomerId, req.CustomerName, req.Notes, req.ExpectedDate,
            req.Items.Select(i => new SalesOrderItemRequest(
                i.ProductId, i.Description, i.Quantity,
                i.UnitPrice, i.DiscountPercent, i.TaxRate)).ToList()), ct), successCode: 201);

    // ── PUT /api/sales-orders/{id} ────────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSORequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new UpdateSalesOrderCommand(
            id, req.CustomerId, req.CustomerName, req.Status, req.Notes, req.ExpectedDate,
            req.Items.Select(i => new SalesOrderItemRequest(
                i.ProductId, i.Description, i.Quantity,
                i.UnitPrice, i.DiscountPercent, i.TaxRate)).ToList()), ct));

    // ── DELETE /api/sales-orders/{id} ─────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new DeleteSalesOrderCommand(id), ct));
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public sealed record SOItemRequest(
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate);

public sealed record CreateSORequest(
    Guid?   CustomerId,
    string? CustomerName,
    string? Notes,
    string? ExpectedDate,
    List<SOItemRequest> Items);

public sealed record UpdateSORequest(
    Guid?   CustomerId,
    string? CustomerName,
    string  Status,
    string? Notes,
    string? ExpectedDate,
    List<SOItemRequest> Items);
