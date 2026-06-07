using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/contacts")][Authorize]
public sealed class ContactsController(CrmDbContext db) : ControllerBase
{
    // GET /api/crm/contacts?customerId=...
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? customerId, CancellationToken ct)
    {
        var q = db.Contacts.AsNoTracking().AsQueryable();
        if (customerId.HasValue) q = q.Where(c => c.CustomerId == customerId.Value);
        var items = await q.OrderByDescending(c => c.IsPrimary).ThenBy(c => c.FirstName).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertContactReq req, CancellationToken ct)
    {
        // If this contact is primary, demote any existing primary for the account.
        if (req.IsPrimary) await DemoteOthers(req.CustomerId, Guid.Empty, ct);
        var c = new Contact(req.CustomerId, req.FirstName, req.LastName, req.Title,
            req.Email, req.Phone, req.Department, req.IsPrimary, req.Notes);
        db.Contacts.Add(c);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(c));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertContactReq req, CancellationToken ct)
    {
        var c = await db.Contacts.FindAsync([id], ct);
        if (c is null) return NotFound();
        if (req.IsPrimary) await DemoteOthers(c.CustomerId, id, ct);
        c.Update(req.FirstName, req.LastName, req.Title, req.Email, req.Phone, req.Department, req.IsPrimary, req.Notes);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/primary")]
    public async Task<IActionResult> SetPrimary(Guid id, CancellationToken ct)
    {
        var c = await db.Contacts.FindAsync([id], ct);
        if (c is null) return NotFound();
        await DemoteOthers(c.CustomerId, id, ct);
        c.SetPrimary(true);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var c = await db.Contacts.FindAsync([id], ct);
        if (c is null) return NotFound();
        c.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task DemoteOthers(Guid customerId, Guid exceptId, CancellationToken ct)
    {
        var others = await db.Contacts.Where(c => c.CustomerId == customerId && c.IsPrimary && c.Id != exceptId).ToListAsync(ct);
        foreach (var o in others) o.SetPrimary(false);
    }

    public record UpsertContactReq(Guid CustomerId, string FirstName, string LastName, string Title,
        string Email, string Phone, string? Department, bool IsPrimary, string? Notes);

    private static object ToDto(Contact c) => new
    {
        c.Id, c.CustomerId, c.FirstName, c.LastName, fullName = c.FullName, c.Title,
        c.Email, c.Phone, c.Department, c.IsPrimary, c.Notes, c.CreatedAt, c.UpdatedAt,
    };
}
