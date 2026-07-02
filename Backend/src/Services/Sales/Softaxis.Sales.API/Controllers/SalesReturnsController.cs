using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Sales.API.Authorization;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.API.Controllers;

[ApiController]
[Route("api/sales/returns")]
[Authorize]
public sealed class SalesReturnsController(SalesDbContext db) : ControllerBase
{
    public record ReturnItemDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice, decimal Total);
    public record ReturnDto(Guid Id, string ReturnNumber, string OrderId, string OrderNumber,
        string CustomerId, string CustomerName, string RequestDate, string Status, string Reason,
        string ReasonDetail, IReadOnlyList<ReturnItemDto> Items, decimal RefundAmount, string Currency,
        string? CreditNote, string? ProcessedBy, string? ProcessedDate, string? RefundMethod,
        DateTime CreatedAt, DateTime? UpdatedAt);

    [HttpGet("summary")]
    [RequirePermission("sales.returns.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.SalesReturns.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.RefundAmount }).ToListAsync(ct);
        return Ok(new {
            total = all.Count, pending = all.Count(x => x.Status == "pending"),
            approved = all.Count(x => x.Status == "approved"),
            refunded = all.Count(x => x.Status == "completed"),
            totalRefundValue = all.Sum(x => x.RefundAmount),
        });
    }

    [HttpGet]
    [RequirePermission("sales.returns.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.SalesReturns.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("sales.returns.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await db.SalesReturns.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return r is null ? NotFound() : Ok(ToDto(r));
    }

    [HttpPost]
    [RequirePermission("sales.returns.create")]
    public async Task<IActionResult> Create([FromBody] CreateReturnRequest req, CancellationToken ct)
    {
        var r = new SalesReturn(req.OrderId, req.OrderNumber, req.CustomerId, req.CustomerName, req.Reason, req.ReasonDetail);
        foreach (var i in req.Items) r.Items.Add(new SalesReturnItem(r.Id, i.Description, i.Quantity, i.UnitPrice));
        db.SalesReturns.Add(r);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = r.Id }, ToDto(r));
    }

    [HttpPost("{id:guid}/approve")]
    [RequirePermission("sales.returns.approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ActionRequest req, CancellationToken ct)
    {
        var r = await db.SalesReturns.FindAsync([id], ct);
        if (r is null) return NotFound();
        r.Approve(req.By);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // No sales.returns.reject/edit key — reject is the approval workflow's counterpart, gate on approve.
    [HttpPost("{id:guid}/reject")]
    [RequirePermission("sales.returns.approve")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ActionRequest req, CancellationToken ct)
    {
        var r = await db.SalesReturns.FindAsync([id], ct);
        if (r is null) return NotFound();
        r.Reject(req.By);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record ItemRequest(string Description, decimal Quantity, decimal UnitPrice);
    public record CreateReturnRequest(string OrderId, string OrderNumber, string CustomerId, string CustomerName,
        string Reason, string ReasonDetail, IReadOnlyList<ItemRequest> Items);
    public record ActionRequest(string By);

    private static ReturnDto ToDto(SalesReturn r) => new(
        r.Id, r.ReturnNumber, r.OrderId, r.OrderNumber, r.CustomerId, r.CustomerName,
        r.RequestDate, r.Status, r.Reason, r.ReasonDetail,
        r.Items.Select(i => new ReturnItemDto(i.Id, i.Description, i.Quantity, i.UnitPrice, i.Total)).ToList(),
        r.RefundAmount, r.Currency, r.CreditNote, r.ProcessedBy, r.ProcessedDate, r.RefundMethod,
        r.CreatedAt, r.UpdatedAt);
}
