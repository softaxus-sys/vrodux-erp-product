using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/deals")][Authorize]
public sealed class PipelineController(CrmDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Deals.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Stage, x.Value }).ToListAsync(ct);
        var won = all.Where(x => x.Stage == "won").ToList();
        var total = all.Count;
        return Ok(new {
            totalDeals = total, totalValue = all.Sum(x => x.Value),
            wonValue = won.Sum(x => x.Value), lostDeals = all.Count(x => x.Stage == "lost"),
            avgDealSize = total > 0 ? all.Average(x => x.Value) : 0,
            winRate = total > 0 ? Math.Round((double)won.Count / total * 100, 1) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Deals.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.Value).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var d = await db.Deals.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return d is null ? NotFound() : Ok(ToDto(d));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDealReq req, CancellationToken ct)
    {
        var d = new Deal(req.Title, req.Company, req.Value, req.Stage, req.Priority,
            req.Probability, req.ExpectedCloseDate, req.AssignedTo, req.Source, req.Industry, req.Description);
        db.Deals.Add(d); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = d.Id }, ToDto(d));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDealReq req, CancellationToken ct)
    {
        var d = await db.Deals.FindAsync([id], ct);
        if (d is null) return NotFound();
        d.Update(req.Title, req.Company, req.Value, req.Stage, req.Priority, req.Probability,
            req.ExpectedCloseDate, req.AssignedTo, req.Source, req.Industry, req.Description,
            req.NextAction, req.NextActionDate, req.Tags);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/stage")]
    public async Task<IActionResult> MoveStage(Guid id, [FromBody] StageReq req, CancellationToken ct)
    {
        var d = await db.Deals.FindAsync([id], ct);
        if (d is null) return NotFound();
        d.MoveStage(req.Stage, req.Probability); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var d = await db.Deals.FindAsync([id], ct);
        if (d is null) return NotFound();
        d.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    public record CreateDealReq(string Title, string Company, decimal Value, string Stage, string Priority,
        int Probability, string ExpectedCloseDate, string AssignedTo, string Source, string Industry, string Description);
    public record UpdateDealReq(string Title, string Company, decimal Value, string Stage, string Priority,
        int Probability, string ExpectedCloseDate, string AssignedTo, string Source, string Industry, string Description,
        string? NextAction, string? NextActionDate, List<string>? Tags);
    public record StageReq(string Stage, int Probability);

    private static object ToDto(Deal d) => new {
        d.Id, d.Title, d.Company, d.Value, d.Currency, d.Stage, d.Priority, d.Probability,
        d.ExpectedCloseDate, d.CreatedDate, d.AssignedTo, d.Source, d.Industry, d.Description,
        tags = d.Tags, contact = new { name="", title="", email="", phone="" },
        activities = Array.Empty<object>(), d.NextAction, d.NextActionDate,
    };
}
