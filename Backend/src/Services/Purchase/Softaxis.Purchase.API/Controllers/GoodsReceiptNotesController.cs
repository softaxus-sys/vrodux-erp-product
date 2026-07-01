using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Purchase.API.Authorization;
using Softaxis.Purchase.API.Controllers.Common;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Commands;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Queries;

namespace Softaxis.Purchase.API.Controllers;

// GRN receives goods against a PO and drives its status; no dedicated permission key,
// so it gates on the nearest one (purchase.orders.*).
[Route("api/purchase/grn")]
[Authorize]
public sealed class GoodsReceiptNotesController(ISender sender) : PurchaseControllerBase
{
    // ── GET /api/purchase/grn ──────────────────────────────────────────────
    [HttpGet]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? purchaseOrderId,
        [FromQuery] Guid? vendorId,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetGoodsReceiptNotesQuery(purchaseOrderId, vendorId), ct);
        return OkOrError(result);
    }

    // ── GET /api/purchase/grn/{id} ─────────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetGoodsReceiptNoteByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/purchase/grn ──────────────────────────────────────────────
    // Receiving goods advances an existing PO's fulfillment → gate on order edit.
    [HttpPost]
    [RequirePermission("purchase.orders.edit")]
    public async Task<IActionResult> Create([FromBody] CreateGoodsReceiptNoteCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }
}
