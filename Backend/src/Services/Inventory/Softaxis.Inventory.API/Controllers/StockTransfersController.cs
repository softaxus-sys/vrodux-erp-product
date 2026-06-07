using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.API.Controllers;

[ApiController]
[Route("api/inventory/transfers")]
[Authorize]
public sealed class StockTransfersController(InventoryDbContext db) : ControllerBase
{
    public record ItemDto(Guid Id, string StockItemId, string ItemName, string Sku, decimal Quantity, decimal UnitCost, decimal Total);
    public record TransferDto(Guid Id, string TransferNumber, string FromWarehouseId, string FromWarehouseName,
        string ToWarehouseId, string ToWarehouseName, string Status, string RequestedBy, string? ApprovedBy,
        string RequestDate, string ExpectedDate, string? ReceivedDate, IReadOnlyList<ItemDto> Items,
        decimal TotalValue, string Notes, DateTime CreatedAt, DateTime? UpdatedAt);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.StockTransfers.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.TotalValue }).ToListAsync(ct);
        return Ok(new {
            total      = all.Count,
            draft      = all.Count(x => x.Status == "draft"),
            pending    = all.Count(x => x.Status == "pending"),
            inTransit  = all.Count(x => x.Status == "in_transit"),
            received   = all.Count(x => x.Status == "received"),
            cancelled  = all.Count(x => x.Status == "cancelled"),
            totalValue = all.Sum(x => x.TotalValue),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.StockTransfers.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var t = await db.StockTransfers.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return t is null ? NotFound() : Ok(ToDto(t));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRequest req, CancellationToken ct)
    {
        var t = new StockTransfer(req.FromWarehouseId, req.FromWarehouseName, req.ToWarehouseId,
            req.ToWarehouseName, req.RequestedBy, req.ExpectedDate, req.Notes);
        foreach (var i in req.Items)
            t.Items.Add(new StockTransferItem(t.Id, i.StockItemId, i.ItemName, i.Sku, i.Quantity, i.UnitCost));
        t.RecalcTotal();
        db.StockTransfers.Add(t);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = t.Id }, ToDto(t));
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var t = await db.StockTransfers.FindAsync([id], ct);
        if (t is null) return NotFound();
        t.Submit(); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ActionReq req, CancellationToken ct)
    {
        var t = await db.StockTransfers.FindAsync([id], ct);
        if (t is null) return NotFound();
        t.Approve(req.By); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("{id:guid}/receive")]
    public async Task<IActionResult> Receive(Guid id, CancellationToken ct)
    {
        var t = await db.StockTransfers.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return NotFound();
        if (t.Status == "received") return NoContent();

        // Relocate stock: decrement source warehouse, increment destination warehouse,
        // and write a Transfer movement at each end. Global product totals are unchanged.
        if (Guid.TryParse(t.FromWarehouseId, out var fromWh) && Guid.TryParse(t.ToWarehouseId, out var toWh))
        {
            foreach (var item in t.Items)
            {
                if (!Guid.TryParse(item.StockItemId, out var productId)) continue;
                var qty = Math.Abs(item.Quantity);

                var src = await GetOrCreateStock(productId, fromWh, ct);
                src.Adjust(-qty);
                var dst = await GetOrCreateStock(productId, toWh, ct);
                dst.Adjust(qty);

                db.StockMovements.Add(new StockMovement(productId, "Transfer", -qty, item.UnitCost, t.TransferNumber, $"Out → {t.ToWarehouseName}", t.FromWarehouseId));
                db.StockMovements.Add(new StockMovement(productId, "Transfer",  qty, item.UnitCost, t.TransferNumber, $"In ← {t.FromWarehouseName}", t.ToWarehouseId));
            }
        }

        t.Receive();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<ProductStock> GetOrCreateStock(Guid productId, Guid warehouseId, CancellationToken ct)
    {
        var existing = await db.ProductStocks
            .FirstOrDefaultAsync(x => x.ProductId == productId && x.WarehouseId == warehouseId, ct);
        if (existing is not null) return existing;
        var created = new ProductStock(productId, warehouseId);
        db.ProductStocks.Add(created);
        return created;
    }

    public record ItemRequest(string StockItemId, string ItemName, string Sku, decimal Quantity, decimal UnitCost);
    public record CreateRequest(string FromWarehouseId, string FromWarehouseName, string ToWarehouseId,
        string ToWarehouseName, string RequestedBy, string ExpectedDate, string? Notes, IReadOnlyList<ItemRequest> Items);
    public record ActionReq(string By);

    private static TransferDto ToDto(StockTransfer t) => new(
        t.Id, t.TransferNumber, t.FromWarehouseId, t.FromWarehouseName,
        t.ToWarehouseId, t.ToWarehouseName, t.Status, t.RequestedBy, t.ApprovedBy,
        t.RequestDate, t.ExpectedDate, t.ReceivedDate,
        t.Items.Select(i => new ItemDto(i.Id, i.StockItemId, i.ItemName, i.Sku, i.Quantity, i.UnitCost, i.Total)).ToList(),
        t.TotalValue, t.Notes ?? "", t.CreatedAt, t.UpdatedAt);
}
