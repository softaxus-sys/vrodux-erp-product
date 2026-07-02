using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.API.Authorization;
using Softaxis.Inventory.Application.StockMovements.Commands.CreateStockMovement;
using Softaxis.Inventory.Application.StockMovements.Queries.GetStockMovements;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Stock movements — receipts, sales, adjustments, write-offs.</summary>
[Authorize]
[Tags("StockMovements")]
[Route("api/inventory/stock-movements")]
public sealed class StockMovementsController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/inventory/stock-movements ───────────────────────────────────
    [HttpGet]
    [RequirePermission("inventory.movements.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int      page         = 1,
        [FromQuery] int      pageSize     = 20,
        [FromQuery] Guid?    productId    = null,
        [FromQuery] string?  movementType = null,
        [FromQuery] DateTime? from        = null,
        [FromQuery] DateTime? to          = null,
        [FromQuery] Guid?    warehouseId  = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetStockMovementsQuery(page, pageSize, productId, movementType, from, to, warehouseId), ct));

    // ── POST /api/inventory/stock-movements ──────────────────────────────────
    [HttpPost]
    [RequirePermission("inventory.movements.create")]
    public async Task<IActionResult> Create([FromBody] CreateMovementRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateStockMovementCommand(
                req.ProductId, req.MovementType, req.Quantity,
                req.UnitCost, req.Reference, req.Notes, req.WarehouseId,
                req.BatchNumber, req.ExpiryDate), ct), 201);
}

public sealed record CreateMovementRequest(
    Guid      ProductId,
    string    MovementType,
    decimal   Quantity,
    decimal   UnitCost,
    string?   Reference,
    string?   Notes,
    Guid?     WarehouseId,
    string?   BatchNumber,
    DateTime? ExpiryDate);
