using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/activities")][Authorize]
public sealed class ActivitiesController(CrmDbContext db) : ControllerBase
{
    // GET /api/crm/activities?relatedToType=lead&relatedToId=...&completed=false
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? relatedToType, [FromQuery] Guid? relatedToId,
        [FromQuery] bool? completed, [FromQuery] string? type, CancellationToken ct = default)
    {
        var q = db.Activities.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(relatedToType)) q = q.Where(a => a.RelatedToType == relatedToType);
        if (relatedToId.HasValue)                      q = q.Where(a => a.RelatedToId == relatedToId.Value);
        if (completed.HasValue)                        q = q.Where(a => a.Completed == completed.Value);
        if (!string.IsNullOrWhiteSpace(type))          q = q.Where(a => a.Type == type);

        var items = await q
            .OrderBy(a => a.Completed)
            .ThenBy(a => a.DueDate == null)            // dated first
            .ThenBy(a => a.DueDate)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var open = await db.Activities.AsNoTracking().Where(a => !a.Completed).ToListAsync(ct);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return Ok(new
        {
            openTasks = open.Count,
            overdue   = open.Count(a => a.DueDate != null && string.CompareOrdinal(a.DueDate, today) < 0),
            dueToday  = open.Count(a => a.DueDate == today),
            upcoming  = open.Count(a => a.DueDate != null && string.CompareOrdinal(a.DueDate, today) > 0),
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateActivityReq req, CancellationToken ct)
    {
        var a = new Activity(req.Type, req.Subject, req.Description,
            req.RelatedToType, req.RelatedToId, req.RelatedToName, req.DueDate, req.AssignedTo);
        db.Activities.Add(a);
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(a));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateActivityReq req, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([id], ct);
        if (a is null) return NotFound();
        a.Update(req.Type, req.Subject, req.Description, req.DueDate, req.AssignedTo);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct) => await Toggle(id, true, ct);

    [HttpPost("{id:guid}/reopen")]
    public async Task<IActionResult> Reopen(Guid id, CancellationToken ct) => await Toggle(id, false, ct);

    private async Task<IActionResult> Toggle(Guid id, bool complete, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([id], ct);
        if (a is null) return NotFound();
        if (complete) a.Complete(); else a.Reopen();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([id], ct);
        if (a is null) return NotFound();
        a.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    public record CreateActivityReq(string Type, string Subject, string? Description,
        string RelatedToType, Guid RelatedToId, string? RelatedToName, string? DueDate, string AssignedTo);
    public record UpdateActivityReq(string Type, string Subject, string? Description, string? DueDate, string AssignedTo);

    private static object ToDto(Activity a) => new
    {
        a.Id, a.Type, a.Subject, a.Description, a.RelatedToType, a.RelatedToId, a.RelatedToName,
        a.DueDate, a.Completed, a.CompletedAt, a.AssignedTo, a.CreatedAt, a.UpdatedAt,
    };
}
