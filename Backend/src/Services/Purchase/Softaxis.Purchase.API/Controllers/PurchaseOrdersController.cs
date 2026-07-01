using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Purchase.API.Authorization;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.API.Controllers;

[ApiController]
[Route("api/purchase/orders")]
[Authorize]
public sealed class PurchaseOrdersController(PurchaseDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record PurchaseOrderItemDto(
        Guid    Id,
        Guid?   ProductId,
        string  Description,
        decimal Quantity,
        decimal UnitCost,
        decimal TaxRate,
        decimal LineTotal);

    public record PurchaseOrderSummaryDto(
        Guid    Id,
        string  OrderNumber,
        Guid    VendorId,
        string  VendorName,
        string  Status,
        decimal SubTotal,
        decimal TaxAmount,
        decimal Total,
        int     ItemCount,
        string? ExpectedDate,
        string? ReceivedDate,
        DateTime CreatedAt,
        DateTime? UpdatedAt);

    public record PurchaseOrderDto(
        Guid    Id,
        string  OrderNumber,
        Guid    VendorId,
        string  VendorName,
        string  Status,
        string? Notes,
        decimal SubTotal,
        decimal TaxAmount,
        decimal Total,
        string? ExpectedDate,
        string? ReceivedDate,
        IReadOnlyList<PurchaseOrderItemDto> Items,
        DateTime CreatedAt,
        DateTime? UpdatedAt);

    public record PagedResult<T>(
        IReadOnlyList<T> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages,
        bool HasNext,
        bool HasPrev);

    public record OrderItemRequest(
        Guid?   ProductId,
        string  Description,
        decimal Quantity,
        decimal UnitCost,
        decimal TaxRate);

    public record CreatePurchaseOrderRequest(
        Guid    VendorId,
        string? Notes,
        string? ExpectedDate,
        IReadOnlyList<OrderItemRequest> Items);

    public record UpdatePurchaseOrderRequest(
        Guid    VendorId,
        string? Notes,
        string? ExpectedDate,
        string  Status,
        IReadOnlyList<OrderItemRequest> Items);

    // ── GET /api/purchase/orders ──────────────────────────────────────────
    [HttpGet]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] Guid?   vendorId = null,
        CancellationToken ct = default)
    {
        IQueryable<PurchaseOrder> query = db.PurchaseOrders
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.OrderNumber.Contains(search) ||
                                     (x.Vendor != null && x.Vendor.Name.Contains(search)));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (vendorId.HasValue)
            query = query.Where(x => x.VendorId == vendorId.Value);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PurchaseOrderSummaryDto(
                x.Id, x.OrderNumber, x.VendorId,
                x.Vendor != null ? x.Vendor.Name : "Unknown",
                x.Status,
                x.Items.Sum(i => i.Quantity * i.UnitCost),
                x.Items.Sum(i => i.Quantity * i.UnitCost * i.TaxRate / 100),
                x.Items.Sum(i => i.Quantity * i.UnitCost) +
                x.Items.Sum(i => i.Quantity * i.UnitCost * i.TaxRate / 100),
                x.Items.Count,
                x.ExpectedDate, x.ReceivedDate,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<PurchaseOrderSummaryDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/purchase/orders/{id} ─────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var order = await db.PurchaseOrders
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (order is null) return NotFound();
        return Ok(ToDto(order));
    }

    // ── POST /api/purchase/orders ─────────────────────────────────────────
    [HttpPost]
    [RequirePermission("purchase.orders.create")]
    public async Task<IActionResult> Create([FromBody] CreatePurchaseOrderRequest req, CancellationToken ct)
    {
        var vendorExists = await db.Vendors.AnyAsync(x => x.Id == req.VendorId, ct);
        if (!vendorExists) return BadRequest(new { message = "Vendor not found." });

        var order = new PurchaseOrder(req.VendorId, req.Notes, req.ExpectedDate);
        foreach (var item in req.Items)
            order.Items.Add(new PurchaseOrderItem(
                order.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitCost, item.TaxRate));

        db.PurchaseOrders.Add(order);
        await db.SaveChangesAsync(ct);

        var vendor = await db.Vendors.FindAsync([req.VendorId], ct);
        // Manually set navigation for response
        return CreatedAtAction(nameof(GetById), new { id = order.Id },
            new PurchaseOrderDto(
                order.Id, order.OrderNumber, order.VendorId,
                vendor?.Name ?? "Unknown",
                order.Status, order.Notes,
                order.SubTotal, order.TaxAmount, order.Total,
                order.ExpectedDate, order.ReceivedDate,
                order.Items.Select(i => new PurchaseOrderItemDto(
                    i.Id, i.ProductId, i.Description,
                    i.Quantity, i.UnitCost, i.TaxRate, i.LineTotal)).ToList(),
                order.CreatedAt, order.UpdatedAt));
    }

    // ── PUT /api/purchase/orders/{id} ─────────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("purchase.orders.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePurchaseOrderRequest req, CancellationToken ct)
    {
        var order = await db.PurchaseOrders
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (order is null) return NotFound();

        order.Update(req.VendorId, req.Notes, req.ExpectedDate, req.Status);

        db.PurchaseOrderItems.RemoveRange(order.Items);
        order.Items.Clear();
        foreach (var item in req.Items)
            order.Items.Add(new PurchaseOrderItem(
                order.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitCost, item.TaxRate));

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── PATCH /api/purchase/orders/{id}/status ────────────────────────────
    [HttpPatch("{id:guid}/status")]
    [RequirePermission("purchase.orders.edit")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] string status, CancellationToken ct)
    {
        var order = await db.PurchaseOrders.FindAsync([id], ct);
        if (order is null) return NotFound();
        order.UpdateStatus(status);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/purchase/orders/{id} ─────────────────────────────────
    // No purchase.orders.delete key seeded — gate on the nearest (edit).
    [HttpDelete("{id:guid}")]
    [RequirePermission("purchase.orders.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var order = await db.PurchaseOrders.FindAsync([id], ct);
        if (order is null) return NotFound();
        order.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helper ───────────────────────────────────────────────────────────
    private static PurchaseOrderDto ToDto(PurchaseOrder o) => new(
        o.Id, o.OrderNumber, o.VendorId,
        o.Vendor?.Name ?? "Unknown",
        o.Status, o.Notes,
        o.SubTotal, o.TaxAmount, o.Total,
        o.ExpectedDate, o.ReceivedDate,
        o.Items.Select(i => new PurchaseOrderItemDto(
            i.Id, i.ProductId, i.Description,
            i.Quantity, i.UnitCost, i.TaxRate, i.LineTotal)).ToList(),
        o.CreatedAt, o.UpdatedAt);
}
