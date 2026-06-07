using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Per-warehouse on-hand stock for a product.</summary>
[ApiController]
[Route("api/inventory/product-stock")]
[Authorize]
public sealed class ProductStockController(InventoryDbContext db) : ControllerBase
{
    public record WarehouseStockDto(
        Guid WarehouseId, string WarehouseName, string? WarehouseCode,
        decimal Quantity, decimal ReorderLevel, bool IsLowStock, bool IsDefault);

    // GET /api/inventory/product-stock/{productId}
    [HttpGet("{productId:guid}")]
    public async Task<IActionResult> GetByProduct(Guid productId, CancellationToken ct)
    {
        // Left-join warehouses so every active warehouse appears, even with no stock row yet.
        var warehouses = await db.Warehouses.AsNoTracking()
            .Where(w => !w.IsDeleted)
            .OrderByDescending(w => w.IsDefault).ThenBy(w => w.Name)
            .ToListAsync(ct);

        var stocks = await db.ProductStocks.AsNoTracking()
            .Where(s => s.ProductId == productId)
            .ToListAsync(ct);

        var rows = warehouses.Select(w =>
        {
            var s = stocks.FirstOrDefault(x => x.WarehouseId == w.Id);
            var qty   = s?.Quantity ?? 0m;
            var level = s?.ReorderLevel ?? 0m;
            return new WarehouseStockDto(
                w.Id, w.Name, w.Code, qty, level,
                level > 0 && qty <= level, w.IsDefault);
        }).ToList();

        return Ok(new
        {
            productId,
            totalOnHand = rows.Sum(r => r.Quantity),
            warehouses  = rows,
        });
    }

    public record BatchDto(Guid Id, string WarehouseName, string BatchNumber,
        DateTime? ExpiryDate, int? DaysToExpiry, decimal Quantity, string Status);

    // GET /api/inventory/product-stock/{productId}/batches
    [HttpGet("{productId:guid}/batches")]
    public async Task<IActionResult> GetBatches(Guid productId, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var batches = await (
            from b in db.ProductBatches.AsNoTracking()
            join w in db.Warehouses.AsNoTracking() on b.WarehouseId equals w.Id
            where b.ProductId == productId && b.Quantity > 0
            orderby b.ExpiryDate
            select new { b.Id, WarehouseName = w.Name, b.BatchNumber, b.ExpiryDate, b.Quantity })
            .ToListAsync(ct);

        var rows = batches.Select(b =>
        {
            int? days = b.ExpiryDate is null ? null : (int)(b.ExpiryDate.Value.Date - today).TotalDays;
            var status = days is null ? "No expiry"
                       : days < 0 ? "Expired"
                       : days <= 30 ? "Expiring soon"
                       : "OK";
            return new BatchDto(b.Id, b.WarehouseName, b.BatchNumber, b.ExpiryDate, days, b.Quantity, status);
        }).ToList();

        return Ok(rows);
    }
}
