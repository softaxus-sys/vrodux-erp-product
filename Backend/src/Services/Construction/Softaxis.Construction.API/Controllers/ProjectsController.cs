using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/projects")][Authorize]
public sealed class ProjectsController(ConstructionDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Projects.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.ContractValue, x.BudgetSpent, x.CompletionPct }).ToListAsync(ct);
        return Ok(new {
            total = all.Count, inProgress = all.Count(x => x.Status == "in_progress"),
            completed = all.Count(x => x.Status == "completed"), onHold = all.Count(x => x.Status == "on_hold"),
            planning = all.Count(x => x.Status == "planning"),
            totalContractValue = all.Sum(x => x.ContractValue), totalSpent = all.Sum(x => x.BudgetSpent),
            avgCompletion = all.Any() ? all.Average(x => x.CompletionPct) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Projects.AsNoTracking().Include(x => x.Phases)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var p = await db.Projects.AsNoTracking().Include(x => x.Phases)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return p is null ? NotFound() : Ok(ToDto(p));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectReq req, CancellationToken ct)
    {
        var p = new Project(req.Name, req.Client, req.Location, req.ProjectType, req.StartDate, req.EndDate,
            req.ContractValue, req.ProjectManager, req.SiteEngineer, req.Notes);
        db.Projects.Add(p); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = p.Id }, ToDto(p));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var p = await db.Projects.FindAsync([id], ct);
        if (p is null) return NotFound(); p.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    public record CreateProjectReq(string Name, string Client, string Location, string ProjectType,
        string StartDate, string EndDate, decimal ContractValue, string ProjectManager, string SiteEngineer, string? Notes);

    private static object ToDto(Project p) => new {
        p.Id, p.ProjectNumber, p.Name, p.Client, p.Location, p.ProjectType, p.Status,
        p.StartDate, p.EndDate, p.ContractValue, p.BudgetSpent, budgetRemaining = p.BudgetRemaining,
        p.CompletionPct, p.ProjectManager, p.SiteEngineer, p.Workers, p.Notes,
        phases = p.Phases.Select(ph => new { ph.Id, ph.Name, ph.StartDate, ph.EndDate, ph.Status, ph.CompletionPct }),
    };
}
