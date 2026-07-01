using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Sales.API.Authorization;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.API.Controllers;

[ApiController]
[Route("api/sales/quotations")]
[Authorize]
public sealed class SalesQuotationsController(SalesDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record QuotationItemDto(
        Guid    Id,
        Guid?   ProductId,
        string  Description,
        decimal Quantity,
        decimal UnitPrice,
        decimal DiscountPercent,
        decimal TaxRate,
        decimal LineTotal);

    public record SalesQuotationSummaryDto(
        Guid    Id,
        string  QuotationNumber,
        Guid?   CustomerId,
        string? CustomerName,
        string  Status,
        decimal DiscountPercent,
        decimal SubTotal,
        decimal TaxAmount,
        decimal Total,
        int     ItemCount,
        string? ValidUntil,
        Guid?   ConvertedOrderId,
        DateTime CreatedAt,
        DateTime? UpdatedAt);

    public record SalesQuotationDto(
        Guid    Id,
        string  QuotationNumber,
        Guid?   CustomerId,
        string? CustomerName,
        string  Status,
        string? Notes,
        decimal DiscountPercent,
        decimal SubTotal,
        decimal TaxAmount,
        decimal Total,
        string? ValidUntil,
        Guid?   ConvertedOrderId,
        IReadOnlyList<QuotationItemDto> Items,
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

    public record QuotationItemRequest(
        Guid?   ProductId,
        string  Description,
        decimal Quantity,
        decimal UnitPrice,
        decimal DiscountPercent,
        decimal TaxRate);

    public record CreateQuotationRequest(
        Guid?   CustomerId,
        string? CustomerName,
        string? Notes,
        string? ValidUntil,
        decimal DiscountPercent,
        IReadOnlyList<QuotationItemRequest> Items);

    public record UpdateQuotationRequest(
        Guid?   CustomerId,
        string? CustomerName,
        string? Notes,
        string? ValidUntil,
        decimal DiscountPercent,
        string  Status,
        IReadOnlyList<QuotationItemRequest> Items);

    // ── GET /api/sales/quotations ─────────────────────────────────────────
    [HttpGet]
    [RequirePermission("sales.quotations.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] Guid?   customerId = null,
        CancellationToken ct = default)
    {
        IQueryable<SalesQuotation> query = db.SalesQuotations
            .AsNoTracking()
            .Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.QuotationNumber.Contains(search) ||
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
            .Select(x => new SalesQuotationSummaryDto(
                x.Id, x.QuotationNumber, x.CustomerId, x.CustomerName, x.Status,
                x.DiscountPercent,
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100)),
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100) * i.TaxRate / 100),
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100)) +
                x.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100) * i.TaxRate / 100),
                x.Items.Count,
                x.ValidUntil, x.ConvertedOrderId,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<SalesQuotationSummaryDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/sales/quotations/{id} ───────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("sales.quotations.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var q = await db.SalesQuotations
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (q is null) return NotFound();
        return Ok(ToDto(q));
    }

    // ── POST /api/sales/quotations ───────────────────────────────────────
    [HttpPost]
    [RequirePermission("sales.quotations.create")]
    public async Task<IActionResult> Create([FromBody] CreateQuotationRequest req, CancellationToken ct)
    {
        var quotation = new SalesQuotation(
            req.CustomerId, req.CustomerName, req.Notes, req.ValidUntil, req.DiscountPercent);

        foreach (var item in req.Items)
            quotation.Items.Add(new SalesQuotationItem(
                quotation.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        db.SalesQuotations.Add(quotation);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = quotation.Id }, ToDto(quotation));
    }

    // ── PUT /api/sales/quotations/{id} ───────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateQuotationRequest req, CancellationToken ct)
    {
        var quotation = await db.SalesQuotations
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (quotation is null) return NotFound();

        quotation.Update(req.CustomerId, req.CustomerName, req.Notes,
            req.ValidUntil, req.DiscountPercent, req.Status);

        db.SalesQuotationItems.RemoveRange(quotation.Items);
        quotation.Items.Clear();
        foreach (var item in req.Items)
            quotation.Items.Add(new SalesQuotationItem(
                quotation.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── POST /api/sales/quotations/{id}/convert ──────────────────────────
    // Convert spawns a sales order from the quotation — gate on quotation edit.
    [HttpPost("{id:guid}/convert")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> ConvertToOrder(Guid id, CancellationToken ct)
    {
        var quotation = await db.SalesQuotations
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (quotation is null) return NotFound();
        if (quotation.Status != "approved")
            return BadRequest(new { message = "Only approved quotations can be converted to orders." });

        var order = new SalesOrder(quotation.CustomerId, quotation.CustomerName, quotation.Notes, null);
        foreach (var item in quotation.Items)
            order.Items.Add(new SalesOrderItem(
                order.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        db.SalesOrders.Add(order);
        quotation.MarkConverted(order.Id);
        await db.SaveChangesAsync(ct);

        return Ok(new { orderId = order.Id, orderNumber = order.OrderNumber });
    }

    // ── DELETE /api/sales/quotations/{id} ────────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("sales.quotations.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var quotation = await db.SalesQuotations.FindAsync([id], ct);
        if (quotation is null) return NotFound();
        quotation.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── Helper ───────────────────────────────────────────────────────────
    private static SalesQuotationDto ToDto(SalesQuotation q) => new(
        q.Id, q.QuotationNumber, q.CustomerId, q.CustomerName, q.Status, q.Notes,
        q.DiscountPercent, q.SubTotal, q.TaxAmount, q.Total,
        q.ValidUntil, q.ConvertedOrderId,
        q.Items.Select(i => new QuotationItemDto(
            i.Id, i.ProductId, i.Description, i.Quantity,
            i.UnitPrice, i.DiscountPercent, i.TaxRate, i.LineTotal)).ToList(),
        q.CreatedAt, q.UpdatedAt);
}
