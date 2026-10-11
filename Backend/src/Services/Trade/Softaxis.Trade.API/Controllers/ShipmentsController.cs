using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Trade.API.Authorization;
using Softaxis.Trade.API.Controllers.Common;
using Softaxis.Trade.Application.Dashboard;
using Softaxis.Trade.Application.Shipments;

namespace Softaxis.Trade.API.Controllers;

public sealed record StatusRequest(string Status, DateOnly? Date, string? Note);

/// <summary>
/// Shipments and everything under them. Each area has its own permission: the figures in costs and
/// payments are not for everyone who can see where the cargo is.
/// </summary>
[Route("api/trade")][Authorize]
public sealed class ShipmentsController(ISender sender) : TradeControllerBase
{
    // ── Dashboard ───────────────────────────────────────────────────────────

    [HttpGet("dashboard")]
    [RequirePermission("trade.shipments.view")]
    public async Task<IActionResult> Dashboard([FromQuery] DateOnly? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTradeDashboardQuery(today), ct));

    // ── Shipments ───────────────────────────────────────────────────────────

    [HttpGet("shipments")]
    [RequirePermission("trade.shipments.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search, [FromQuery] string? direction, [FromQuery] string? status,
        [FromQuery] Guid? partnerId, [FromQuery] bool openOnly, [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetShipmentsQuery(search, direction, status, partnerId, openOnly, page, pageSize), ct));

    [HttpGet("shipments/{id:guid}")]
    [RequirePermission("trade.shipments.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetShipmentByIdQuery(id), ct));

    [HttpPost("shipments")]
    [RequirePermission("trade.shipments.create")]
    public async Task<IActionResult> Create([FromBody] ShipmentInput input, [FromQuery] DateOnly? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateShipmentCommand(input, today), ct));

    [HttpPut("shipments/{id:guid}")]
    [RequirePermission("trade.shipments.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ShipmentInput input, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateShipmentCommand(id, input), ct));

    [HttpPatch("shipments/{id:guid}/status")]
    [RequirePermission("trade.shipments.edit")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] StatusRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ChangeShipmentStatusCommand(id, req.Status, req.Date, req.Note), ct));

    [HttpDelete("shipments/{id:guid}")]
    [RequirePermission("trade.shipments.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteShipmentCommand(id), ct));

    // ── Costs (landed cost) ─────────────────────────────────────────────────

    [HttpPost("shipments/{id:guid}/costs")]
    [RequirePermission("trade.costs.create")]
    public async Task<IActionResult> AddCost(Guid id, [FromBody] CostInput cost, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddShipmentCostCommand(id, cost), ct));

    [HttpPut("shipments/{id:guid}/costs/{costId:guid}")]
    [RequirePermission("trade.costs.edit")]
    public async Task<IActionResult> UpdateCost(Guid id, Guid costId, [FromBody] CostInput cost, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateShipmentCostCommand(id, costId, cost), ct));

    [HttpDelete("shipments/{id:guid}/costs/{costId:guid}")]
    [RequirePermission("trade.costs.delete")]
    public async Task<IActionResult> RemoveCost(Guid id, Guid costId, CancellationToken ct) =>
        OkOrError(await sender.Send(new RemoveShipmentCostCommand(id, costId), ct));

    // ── Payments (advance, letter of credit, balance) ───────────────────────

    [HttpPost("shipments/{id:guid}/payments")]
    [RequirePermission("trade.payments.create")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] PaymentInput payment, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddShipmentPaymentCommand(id, payment), ct));

    [HttpPut("shipments/{id:guid}/payments/{paymentId:guid}")]
    [RequirePermission("trade.payments.edit")]
    public async Task<IActionResult> UpdatePayment(Guid id, Guid paymentId, [FromBody] PaymentInput payment, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateShipmentPaymentCommand(id, paymentId, payment), ct));

    [HttpDelete("shipments/{id:guid}/payments/{paymentId:guid}")]
    [RequirePermission("trade.payments.edit")]
    public async Task<IActionResult> RemovePayment(Guid id, Guid paymentId, CancellationToken ct) =>
        OkOrError(await sender.Send(new RemoveShipmentPaymentCommand(id, paymentId), ct));

    // ── Documents ───────────────────────────────────────────────────────────

    [HttpPost("shipments/{id:guid}/documents")]
    [RequirePermission("trade.documents.create")]
    public async Task<IActionResult> AddDocument(Guid id, [FromBody] DocumentInput document, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddDocumentCommand(id, document), ct));

    [HttpPut("documents/{docId:guid}")]
    [RequirePermission("trade.documents.edit")]
    public async Task<IActionResult> UpdateDocument(Guid docId, [FromBody] DocumentInput document, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateDocumentCommand(docId, document), ct));

    [HttpDelete("documents/{docId:guid}")]
    [RequirePermission("trade.documents.delete")]
    public async Task<IActionResult> DeleteDocument(Guid docId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDocumentCommand(docId), ct));

    [HttpGet("documents/{docId:guid}/file")]
    [RequirePermission("trade.documents.view")]
    public async Task<IActionResult> DownloadDocument(Guid docId, CancellationToken ct)
    {
        var result = await sender.Send(new GetDocumentFileQuery(docId), ct);
        if (!result.IsSuccess) return OkOrError(result);
        var f = result.Value;
        return File(f.Content, f.ContentType, f.FileName);
    }
}
