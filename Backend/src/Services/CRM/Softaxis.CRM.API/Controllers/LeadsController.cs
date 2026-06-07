using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/leads")][Authorize]
public sealed class LeadsController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Leads.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.EstimatedValue, x.CreatedAt }).ToListAsync(ct);
        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var converted = all.Count(x => x.Status == "converted");
        var total = all.Count;
        return Ok(new {
            total, newThisWeek = all.Count(x => x.CreatedAt >= weekAgo),
            qualified = all.Count(x => x.Status == "qualified"),
            contacted = all.Count(x => x.Status == "contacted"),
            converted,
            conversionRate = total > 0 ? Math.Round((double)converted / total * 100, 1) : 0,
            totalEstimatedValue = all.Sum(x => x.EstimatedValue),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Leads.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var l = await db.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return l is null ? NotFound() : Ok(ToDto(l));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLeadReq req, CancellationToken ct)
    {
        var l = new Lead(req.FirstName, req.LastName, req.Title, req.Company, req.Industry,
            req.Email, req.Phone, req.Country, req.City, req.Source, req.Priority, req.EstimatedValue, req.AssignedTo, req.Notes);
        db.Leads.Add(l); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = l.Id }, ToDto(l));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLeadReq req, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([id], ct);
        if (l is null) return NotFound();
        l.Update(req.FirstName, req.LastName, req.Title, req.Company, req.Industry,
            req.Email, req.Phone, req.Country, req.City, req.Source, req.Priority,
            req.EstimatedValue, req.AssignedTo, req.Score, req.NextFollowUp, req.Notes, req.Tags);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([id], ct);
        if (l is null) return NotFound();
        l.UpdateStatus(req.Status); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpPatch("{id:guid}/score")]
    public async Task<IActionResult> UpdateScore(Guid id, [FromBody] ScoreReq req, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([id], ct);
        if (l is null) return NotFound();
        l.UpdateScore(req.Score); await db.SaveChangesAsync(ct); return NoContent();
    }

    /// <summary>Convert a lead into a customer + an open deal, then mark the lead converted.</summary>
    [HttpPost("{id:guid}/convert")]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertReq req, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([id], ct);
        if (l is null) return NotFound();
        if (l.Status == "converted") return BadRequest(new { error = "Lead is already converted." });

        var customer = new CrmCustomer(l.Company, l.Industry, l.Country, l.City, "",
            l.Phone, l.Email, "standard", l.AssignedTo, l.Notes ?? "");
        db.Customers.Add(customer);

        var deal = new Deal(
            string.IsNullOrWhiteSpace(req.DealTitle) ? $"{l.Company} — New Opportunity" : req.DealTitle!,
            l.Company, req.DealValue ?? l.EstimatedValue, "qualified", l.Priority,
            20, req.ExpectedCloseDate ?? DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"),
            l.AssignedTo, l.Source, l.Industry, l.Notes ?? "");
        db.Deals.Add(deal);

        l.Convert(deal.Id.ToString());
        await db.SaveChangesAsync(ct);
        return Ok(new { customerId = customer.Id, dealId = deal.Id });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([id], ct);
        if (l is null) return NotFound();
        l.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    public record CreateLeadReq(string FirstName, string LastName, string Title, string Company, string Industry,
        string Email, string Phone, string Country, string City, string Source, string Priority,
        decimal EstimatedValue, string AssignedTo, string? Notes);
    public record UpdateLeadReq(string FirstName, string LastName, string Title, string Company, string Industry,
        string Email, string Phone, string Country, string City, string Source, string Priority,
        decimal EstimatedValue, string AssignedTo, int Score, string? NextFollowUp, string? Notes, List<string>? Tags);
    public record StatusReq(string Status);
    public record ScoreReq(int Score);
    public record ConvertReq(string? DealTitle, decimal? DealValue, string? ExpectedCloseDate);

    private static object ToDto(Lead l) => new {
        l.Id, l.FirstName, l.LastName, fullName = l.FullName, l.Title, l.Company, l.Industry,
        l.Email, l.Phone, l.Country, l.City, l.Source, l.Status, l.Priority, l.Score,
        l.EstimatedValue, l.Currency, l.AssignedTo, l.CreatedDate, l.LastContactDate,
        l.NextFollowUp, l.Notes, l.ConvertedDealId, tags = l.Tags, activities = Array.Empty<object>(),
        l.CreatedAt, l.UpdatedAt,
    };
}
