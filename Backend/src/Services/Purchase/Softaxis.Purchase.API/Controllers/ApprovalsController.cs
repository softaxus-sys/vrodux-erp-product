using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.API.Controllers;

[ApiController]
[Route("api/purchase/approvals")]
[Authorize]
public sealed class ApprovalsController(PurchaseDbContext db) : ControllerBase
{
    public record ItemDto(Guid Id, string Description, decimal Quantity, decimal EstimatedUnitPrice, decimal Total);
    public record ApprovalDto(Guid Id, string RequestNumber, string Title, string RequestedBy, string Department,
        string RequestDate, string RequiredBy, string Status, string Priority, string Category,
        string? VendorSuggestion, IReadOnlyList<ItemDto> Items, decimal TotalAmount, string Currency,
        string Justification, string? ApprovedBy, string? ApprovedDate, string? RejectionReason,
        string? ConvertedToPO, DateTime CreatedAt, DateTime? UpdatedAt);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.PurchaseApprovals.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.TotalAmount }).ToListAsync(ct);
        return Ok(new {
            total = all.Count, pending = all.Count(x => x.Status == "pending"),
            approved = all.Count(x => x.Status == "approved"),
            rejected = all.Count(x => x.Status == "rejected"),
            totalRequestedValue = all.Sum(x => x.TotalAmount),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.PurchaseApprovals.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var a = await db.PurchaseApprovals.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return a is null ? NotFound() : Ok(ToDto(a));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRequest req, CancellationToken ct)
    {
        var a = new PurchaseApproval(req.Title, req.RequestedBy, req.Department, req.RequiredBy,
            req.Priority, req.Category, req.VendorSuggestion, req.Justification, req.Currency);
        foreach (var i in req.Items) a.Items.Add(new PurchaseApprovalItem(a.Id, i.Description, i.Quantity, i.EstimatedUnitPrice));
        a.RecalcTotal();
        db.PurchaseApprovals.Add(a);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = a.Id }, ToDto(a));
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ActionRequest req, CancellationToken ct)
    {
        var a = await db.PurchaseApprovals.FindAsync([id], ct);
        if (a is null) return NotFound();
        a.Approve(req.By); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectRequest req, CancellationToken ct)
    {
        var a = await db.PurchaseApprovals.FindAsync([id], ct);
        if (a is null) return NotFound();
        a.Reject(req.By, req.Reason); await db.SaveChangesAsync(ct); return NoContent();
    }

    public record ItemRequest(string Description, decimal Quantity, decimal EstimatedUnitPrice);
    public record CreateRequest(string Title, string RequestedBy, string Department, string RequiredBy,
        string Priority, string Category, string? VendorSuggestion, string Justification, string Currency,
        IReadOnlyList<ItemRequest> Items);
    public record ActionRequest(string By);
    public record RejectRequest(string By, string Reason);

    private static ApprovalDto ToDto(PurchaseApproval a) => new(
        a.Id, a.RequestNumber, a.Title, a.RequestedBy, a.Department, a.RequestDate, a.RequiredBy,
        a.Status, a.Priority, a.Category, a.VendorSuggestion,
        a.Items.Select(i => new ItemDto(i.Id, i.Description, i.Quantity, i.EstimatedUnitPrice, i.Total)).ToList(),
        a.TotalAmount, a.Currency, a.Justification, a.ApprovedBy, a.ApprovedDate,
        a.RejectionReason, a.ConvertedToPO, a.CreatedAt, a.UpdatedAt);
}
