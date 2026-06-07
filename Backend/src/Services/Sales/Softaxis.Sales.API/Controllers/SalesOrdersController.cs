using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.API.Controllers;

[ApiController]
[Route("api/sales/orders")]
[Authorize]
public sealed class SalesOrdersController(SalesDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record SalesOrderItemDto(
        Guid    Id,
        Guid?   ProductId,
        string  Description,
        decimal Quantity,
        decimal UnitPrice,
        decimal DiscountPercent,
        decimal TaxRate,
        decimal LineTotal);

    public record SalesOrderSummaryDto(
        Guid    Id,
        string  OrderNumber,
        Guid?   CustomerId,
        string? CustomerName,
        string  Status,
        decimal SubTotal,
        decimal TaxAmount,
        decimal Total,
        int     ItemCount,
        string? ExpectedDate,
        string? DeliveredDate,
        DateTime CreatedAt,
        DateTime? UpdatedAt);

    public record SalesOrderDto(
        Guid    Id,
        string  OrderNumber,
        Guid?   CustomerId,
        string? CustomerName,
        string  Status,
        string? Notes,
        decimal SubTotal,
        decimal TaxAmount,
        decimal Total,
        string? ExpectedDate,
        string? DeliveredDate,
        IReadOnlyList<SalesOrderItemDto> Items,
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
        decimal UnitPrice,
        decimal DiscountPercent,
        decimal TaxRate);

    public record CreateSalesOrderRequest(
        Guid?   CustomerId,
        string? CustomerName,
        string? Notes,
        string? ExpectedDate,
        IReadOnlyList<OrderItemRequest> Items);

    public record UpdateSalesOrderRequest(
        Guid?   CustomerId,
        string? CustomerName,
        string? Notes,
        string? ExpectedDate,
        string  Status,
        IReadOnlyList<OrderItemRequest> Items);

    // ── GET /api/sales/orders ─────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] Guid?   customerId = null,
        CancellationToken ct = default)
    {
        IQueryable<SalesOrder> query = db.SalesOrders
            .AsNoTracking()
            .Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.OrderNumber.Contains(search) ||
                                     (x.CustomerName != null && x.CustomerName.Contains(search)));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (customerId.HasValue)
            query = query.Where(x => x.CustomerId == customerId.Value);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new SalesOrderSummaryDto(
                x.Id, x.OrderNumber, x.CustomerId, x.CustomerName, x.Status,
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100)),
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100) * i.TaxRate / 100),
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100)) +
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100) * i.TaxRate / 100),
                x.Items.Count,
                x.ExpectedDate, x.DeliveredDate,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<SalesOrderSummaryDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/sales/orders/{id} ───────────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var order = await db.SalesOrders
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (order is null) return NotFound();

        return Ok(ToDto(order));
    }

    // ── POST /api/sales/orders ───────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSalesOrderRequest req, CancellationToken ct)
    {
        var order = new SalesOrder(req.CustomerId, req.CustomerName, req.Notes, req.ExpectedDate);

        foreach (var item in req.Items)
            order.Items.Add(new SalesOrderItem(
                order.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        db.SalesOrders.Add(order);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, ToDto(order));
    }

    // ── PUT /api/sales/orders/{id} ───────────────────────────────────────
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateSalesOrderRequest req, CancellationToken ct)
    {
        var order = await db.SalesOrders
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (order is null) return NotFound();

        order.Update(req.CustomerId, req.CustomerName, req.Notes, req.ExpectedDate, req.Status);

        // Replace items
        db.SalesOrderItems.RemoveRange(order.Items);
        order.Items.Clear();
        foreach (var item in req.Items)
            order.Items.Add(new SalesOrderItem(
                order.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── PATCH /api/sales/orders/{id}/status ─────────────────────────────
    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] string status, CancellationToken ct)
    {
        var order = await db.SalesOrders
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (order is null) return NotFound();

        order.Update(order.CustomerId, order.CustomerName, null, order.ExpectedDate, status);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/sales/orders/{id} ───────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var order = await db.SalesOrders.FindAsync([id], ct);
        if (order is null) return NotFound();
        order.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helper ───────────────────────────────────────────────────────────
    private static SalesOrderDto ToDto(SalesOrder o) => new(
        o.Id, o.OrderNumber, o.CustomerId, o.CustomerName, o.Status, o.Notes,
        o.SubTotal, o.TaxAmount, o.Total,
        o.ExpectedDate, o.DeliveredDate,
        o.Items.Select(i => new SalesOrderItemDto(
            i.Id, i.ProductId, i.Description, i.Quantity,
            i.UnitPrice, i.DiscountPercent, i.TaxRate, i.LineTotal)).ToList(),
        o.CreatedAt, o.UpdatedAt);
}
