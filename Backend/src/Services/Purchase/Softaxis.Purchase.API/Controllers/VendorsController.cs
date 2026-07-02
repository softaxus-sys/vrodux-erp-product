using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Purchase.API.Authorization;
using Softaxis.Purchase.Domain.Entities;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.API.Controllers;

[ApiController]
[Route("api/purchase/vendors")]
[Authorize]
public sealed class VendorsController(PurchaseDbContext db) : ControllerBase
{
    // ── DTOs ─────────────────────────────────────────────────────────────
    public record VendorDto(
        Guid    Id,
        string  Name,
        string? Code,
        string  Category,
        string? ContactPerson,
        string? Email,
        string? Phone,
        string? Address,
        string? TaxNumber,
        string  PaymentTerms,
        string  Currency,
        string? Notes,
        string  Status,
        decimal Rating,
        int     PurchaseOrderCount,
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

    public record UpsertVendorRequest(
        string  Name,
        string? Code,
        string? Category,
        string? ContactPerson,
        string? Email,
        string? Phone,
        string? Address,
        string? TaxNumber,
        string? PaymentTerms,
        string? Currency,
        string? Notes,
        string  Status  = "active",
        decimal Rating  = 0);

    // ── GET /api/purchase/vendors ─────────────────────────────────────────
    [HttpGet]
    [RequirePermission("purchase.vendors.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        IQueryable<Vendor> query = db.Vendors.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.Name.Contains(search) ||
                                     (x.Code  != null && x.Code.Contains(search)) ||
                                     (x.Email != null && x.Email.Contains(search)));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(x => x.Category == category);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new VendorDto(
                x.Id, x.Name, x.Code, x.Category, x.ContactPerson,
                x.Email, x.Phone, x.Address, x.TaxNumber,
                x.PaymentTerms, x.Currency, x.Notes, x.Status, x.Rating,
                x.PurchaseOrders.Count(p => !p.IsDeleted),
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<VendorDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    // ── GET /api/purchase/vendors/{id} ───────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("purchase.vendors.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var v = await db.Vendors
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new VendorDto(
                x.Id, x.Name, x.Code, x.Category, x.ContactPerson,
                x.Email, x.Phone, x.Address, x.TaxNumber,
                x.PaymentTerms, x.Currency, x.Notes, x.Status, x.Rating,
                x.PurchaseOrders.Count(p => !p.IsDeleted),
                x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        return v is null ? NotFound() : Ok(v);
    }

    // ── POST /api/purchase/vendors ────────────────────────────────────────
    [HttpPost]
    [RequirePermission("purchase.vendors.create")]
    public async Task<IActionResult> Create([FromBody] UpsertVendorRequest req, CancellationToken ct)
    {
        var vendor = new Vendor(req.Name, req.Code, req.Category, req.ContactPerson,
            req.Email, req.Phone, req.Address, req.TaxNumber,
            req.PaymentTerms, req.Currency, req.Notes);

        if (req.Status != "active" || req.Rating != 0)
            vendor.Update(req.Name, req.Code, req.Category, req.ContactPerson,
                req.Email, req.Phone, req.Address, req.TaxNumber,
                req.PaymentTerms, req.Currency, req.Notes, req.Status, req.Rating);

        db.Vendors.Add(vendor);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = vendor.Id },
            new VendorDto(vendor.Id, vendor.Name, vendor.Code, vendor.Category,
                vendor.ContactPerson, vendor.Email, vendor.Phone, vendor.Address,
                vendor.TaxNumber, vendor.PaymentTerms, vendor.Currency, vendor.Notes,
                vendor.Status, vendor.Rating, 0, vendor.CreatedAt, vendor.UpdatedAt));
    }

    // ── PUT /api/purchase/vendors/{id} ───────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("purchase.vendors.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertVendorRequest req, CancellationToken ct)
    {
        var vendor = await db.Vendors.FindAsync([id], ct);
        if (vendor is null) return NotFound();

        vendor.Update(req.Name, req.Code, req.Category, req.ContactPerson,
            req.Email, req.Phone, req.Address, req.TaxNumber,
            req.PaymentTerms, req.Currency, req.Notes, req.Status, req.Rating);

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DELETE /api/purchase/vendors/{id} ────────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("purchase.vendors.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var vendor = await db.Vendors.FindAsync([id], ct);
        if (vendor is null) return NotFound();
        vendor.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
