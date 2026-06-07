using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.PurchaseOrders.Commands.CreatePurchaseOrder;
using Softaxis.POS.Application.PurchaseOrders.Commands.DeletePurchaseOrder;
using Softaxis.POS.Application.PurchaseOrders.Commands.UpdatePurchaseOrder;
using Softaxis.POS.Application.PurchaseOrders.Commands.UpdatePurchaseOrderStatus;
using Softaxis.POS.Application.PurchaseOrders.Queries.GetPurchaseOrderById;
using Softaxis.POS.Application.PurchaseOrders.Queries.GetPurchaseOrders;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/purchase-orders")]
[Tags("PurchaseOrders")]
public sealed class PurchaseOrdersController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/purchase-orders ──────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status   = null,
        [FromQuery] Guid?   vendorId = null,
        [FromQuery] string? from     = null,
        [FromQuery] string? to       = null,
        [FromQuery] string? search   = null,
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 25,
        CancellationToken ct = default) =>
        HandleResult(await Sender.Send(
            new GetPurchaseOrdersQuery(status, vendorId, from, to, search, page, pageSize), ct));

    // ── GET /api/purchase-orders/{id} ─────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetPurchaseOrderByIdQuery(id), ct));

    // ── POST /api/purchase-orders ─────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePORequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new CreatePurchaseOrderCommand(
            req.VendorId, req.Notes, req.ExpectedDate,
            req.Items.Select(i => new PurchaseOrderItemRequest(
                i.ProductId, i.Description, i.Quantity, i.UnitCost, i.TaxRate)).ToList()), ct), successCode: 201);

    // ── PUT /api/purchase-orders/{id} ─────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePORequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new UpdatePurchaseOrderCommand(
            id, req.VendorId, req.Status, req.Notes, req.ExpectedDate,
            req.Items.Select(i => new PurchaseOrderItemRequest(
                i.ProductId, i.Description, i.Quantity, i.UnitCost, i.TaxRate)).ToList()), ct));

    // ── PATCH /api/purchase-orders/{id}/status ────────────────────────────────
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] string status, CancellationToken ct) =>
        HandleResult(await Sender.Send(new UpdatePurchaseOrderStatusCommand(id, status), ct));

    // ── DELETE /api/purchase-orders/{id} ──────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new DeletePurchaseOrderCommand(id), ct));
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public sealed record POItemRequest(
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitCost,
    decimal TaxRate);

public sealed record CreatePORequest(
    Guid    VendorId,
    string? Notes,
    string? ExpectedDate,
    List<POItemRequest> Items);

public sealed record UpdatePORequest(
    Guid    VendorId,
    string  Status,
    string? Notes,
    string? ExpectedDate,
    List<POItemRequest> Items);
