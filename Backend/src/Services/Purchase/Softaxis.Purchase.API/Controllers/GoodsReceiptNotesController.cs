using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Purchase.API.Controllers.Common;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Commands;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Queries;

namespace Softaxis.Purchase.API.Controllers;

[Route("api/purchase/grn")]
[Authorize]
public sealed class GoodsReceiptNotesController(ISender sender) : PurchaseControllerBase
{
    // ── GET /api/purchase/grn ──────────────────────────────────────────────
    [HttpGet]
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
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetGoodsReceiptNoteByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/purchase/grn ──────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGoodsReceiptNoteCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }
}
