using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.SalesQuotations.Commands.ConvertQuotationToOrder;
using Softaxis.POS.Application.SalesQuotations.Commands.CreateSalesQuotation;
using Softaxis.POS.Application.SalesQuotations.Commands.DeleteSalesQuotation;
using Softaxis.POS.Application.SalesQuotations.Commands.UpdateSalesQuotation;
using Softaxis.POS.Application.SalesQuotations.Queries.GetSalesQuotationById;
using Softaxis.POS.Application.SalesQuotations.Queries.GetSalesQuotations;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/sales-quotations")]
[Tags("SalesQuotations")]
public sealed class SalesQuotationsController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/sales-quotations ─────────────────────────────────────────────
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
            new GetSalesQuotationsQuery(status, customerId, from, to, search, page, pageSize), ct));

    // ── GET /api/sales-quotations/{id} ────────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new GetSalesQuotationByIdQuery(id), ct));

    // ── POST /api/sales-quotations ────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSQRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new CreateSalesQuotationCommand(
            req.CustomerId, req.CustomerName, req.Notes, req.ValidUntil,
            req.Items.Select(i => new QuotationItemRequest(
                i.ProductId, i.Description, i.Quantity,
                i.UnitPrice, i.DiscountPercent, i.TaxRate)).ToList()), ct), successCode: 201);

    // ── PUT /api/sales-quotations/{id} ────────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSQRequest req, CancellationToken ct) =>
        HandleResult(await Sender.Send(new UpdateSalesQuotationCommand(
            id, req.CustomerId, req.CustomerName, req.Status, req.Notes, req.ValidUntil,
            req.Items.Select(i => new QuotationItemRequest(
                i.ProductId, i.Description, i.Quantity,
                i.UnitPrice, i.DiscountPercent, i.TaxRate)).ToList()), ct));

    // ── POST /api/sales-quotations/{id}/convert ───────────────────────────────
    [HttpPost("{id:guid}/convert")]
    public async Task<IActionResult> ConvertToOrder(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new ConvertQuotationToOrderCommand(id), ct));

    // ── DELETE /api/sales-quotations/{id} ─────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        HandleResult(await Sender.Send(new DeleteSalesQuotationCommand(id), ct));
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public sealed record SQItemRequest(
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate);

public sealed record CreateSQRequest(
    Guid?   CustomerId,
    string? CustomerName,
    string? Notes,
    string? ValidUntil,
    List<SQItemRequest> Items);

public sealed record UpdateSQRequest(
    Guid?   CustomerId,
    string? CustomerName,
    string  Status,
    string? Notes,
    string? ValidUntil,
    List<SQItemRequest> Items);
