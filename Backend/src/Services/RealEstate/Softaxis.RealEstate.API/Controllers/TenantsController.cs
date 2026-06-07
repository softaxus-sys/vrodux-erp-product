using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/tenants")][Authorize]
public sealed class TenantsController(RealEstateDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Tenants.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.TenantType, x.Status, x.ActiveContracts, x.TotalPaid }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            individual = all.Count(x => x.TenantType == "individual"),
            company = all.Count(x => x.TenantType == "company"),
            active = all.Count(x => x.Status == "active"),
            inactive = all.Count(x => x.Status == "inactive"),
            totalActiveContracts = all.Sum(x => x.ActiveContracts),
            totalPaid = all.Sum(x => x.TotalPaid),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Tenants.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name).ToListAsync(ct);
        return Ok(items.Select(t => new {
            t.Id, t.TenantNumber, t.Name, t.TenantType, t.Email, t.Phone,
            t.NationalId, t.CompanyName, t.TradeLicense, t.Nationality,
            t.Status, t.ActiveContracts, t.TotalPaid,
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTenantReq req, CancellationToken ct)
    {
        var t = new Tenant(req.Name, req.TenantType, req.Email, req.Phone, req.Nationality,
            req.NationalId, req.CompanyName, req.TradeLicense);
        db.Tenants.Add(t); await db.SaveChangesAsync(ct);
        return CreatedAtAction(null, new { t.Id }, new { t.Id, t.TenantNumber, t.Name });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var t = await db.Tenants.FindAsync([id], ct);
        if (t is null) return NotFound(); t.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    public record CreateTenantReq(string Name, string TenantType, string Email, string Phone,
        string Nationality, string? NationalId, string? CompanyName, string? TradeLicense);
}
