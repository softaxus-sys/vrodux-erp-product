using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Purchase.API.Authorization;
using Softaxis.Purchase.API.Controllers.Common;
using Softaxis.Purchase.Application.PurchaseReturns.Commands;
using Softaxis.Purchase.Application.PurchaseReturns.Queries;

namespace Softaxis.Purchase.API.Controllers;

// Purchase returns record goods returned to a vendor against a PO; no dedicated permission
// key, so they gate on the nearest one (purchase.orders.*).
[Route("api/purchase/returns")]
[Authorize]
public sealed class PurchaseReturnsController(ISender sender) : PurchaseControllerBase
{
    // ── GET /api/purchase/returns ──────────────────────────────────────────
    [HttpGet]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? purchaseOrderId,
        [FromQuery] Guid? vendorId,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetPurchaseReturnsQuery(purchaseOrderId, vendorId), ct);
        return OkOrError(result);
    }

    // ── GET /api/purchase/returns/{id} ─────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPurchaseReturnByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/purchase/returns ──────────────────────────────────────────
    // Recording a vendor return is a post-PO operation → gate on order edit.
    [HttpPost]
    [RequirePermission("purchase.orders.edit")]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseReturnCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }
}
