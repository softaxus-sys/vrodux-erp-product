using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Purchase.API.Controllers.Common;
using Softaxis.Purchase.Application.PurchaseReturns.Commands;
using Softaxis.Purchase.Application.PurchaseReturns.Queries;

namespace Softaxis.Purchase.API.Controllers;

[Route("api/purchase/returns")]
[Authorize]
public sealed class PurchaseReturnsController(ISender sender) : PurchaseControllerBase
{
    // ── GET /api/purchase/returns ──────────────────────────────────────────
    [HttpGet]
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
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetPurchaseReturnByIdQuery(id), ct);
        return OkOrError(result);
    }

    // ── POST /api/purchase/returns ──────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseReturnCommand command, CancellationToken ct)
    {
        var result = await sender.Send(command, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }
}
