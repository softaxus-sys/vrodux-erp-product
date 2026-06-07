using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/customers")][Authorize]
public sealed class CrmCustomersController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Customers.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Tier, x.TotalRevenue, x.OpenDeals, x.NpsScore }).ToListAsync(ct);
        var withNps = all.Where(x => x.NpsScore.HasValue).ToList();
        return Ok(new {
            total = all.Count, active = all.Count(x => x.Status == "active"),
            inactive = all.Count(x => x.Status == "inactive"),
            platinum = all.Count(x => x.Tier == "platinum"), gold = all.Count(x => x.Tier == "gold"),
            totalRevenue = all.Sum(x => x.TotalRevenue), openDeals = all.Sum(x => x.OpenDeals),
            avgNps = withNps.Any() ? withNps.Average(x => x.NpsScore!.Value) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Customers.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.TotalRevenue).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return c is null ? NotFound() : Ok(ToDto(c));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCrmCustomerReq req, CancellationToken ct)
    {
        var c = new CrmCustomer(req.Name, req.Industry, req.Country, req.City, req.Address,
            req.Phone, req.Email, req.Tier, req.AccountManager, req.Description);
        db.Customers.Add(c); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = c.Id }, ToDto(c));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCrmCustomerReq req, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([id], ct);
        if (c is null) return NotFound();
        c.Update(req.Name, req.Industry, req.Country, req.City, req.Address, req.Phone, req.Email,
            req.Status, req.Tier, req.AccountManager, req.Description,
            req.Website, req.TradeName, req.Employees, req.NpsScore, req.ContractRenewal, req.Tags);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([id], ct);
        if (c is null) return NotFound();
        c.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    public record CreateCrmCustomerReq(string Name, string Industry, string Country, string City,
        string Address, string Phone, string Email, string Tier, string AccountManager, string Description);
    public record UpdateCrmCustomerReq(string Name, string Industry, string Country, string City,
        string Address, string Phone, string Email, string Status, string Tier, string AccountManager,
        string Description, string? Website, string? TradeName, string? Employees, int? NpsScore,
        string? ContractRenewal, List<string>? Tags);

    private static object ToDto(CrmCustomer c) => new {
        c.Id, c.Name, c.TradeName, c.Industry, c.Website, c.Country, c.City, c.Address,
        c.Phone, c.Email, c.Status, c.Tier, c.AccountManager, c.Since, c.LastActivity,
        c.TotalRevenue, c.OpenDeals, c.Currency, c.Employees, c.Description,
        contacts = Array.Empty<object>(), deals = Array.Empty<object>(), activities = Array.Empty<object>(),
        tags = c.Tags, c.ContractRenewal, c.NpsScore,
    };
}
