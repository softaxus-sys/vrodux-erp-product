using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/housekeeping")][Authorize]
public sealed class HousekeepingController(HospitalityDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.HousekeepingTasks.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Priority, x.TaskType }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            pending = all.Count(x => x.Status == "pending"),
            inProgress = all.Count(x => x.Status == "in_progress"),
            completed = all.Count(x => x.Status == "completed"),
            verified = all.Count(x => x.Status == "verified"),
            urgent = all.Count(x => x.Priority == "urgent"),
            high = all.Count(x => x.Priority == "high"),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.HousekeepingTasks.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Status).ThenBy(x => x.Priority).ToListAsync(ct);
        return Ok(items.Select(h => new {
            h.Id, h.RoomId, h.RoomNumber, h.TaskType, h.Priority, h.Status,
            h.AssignedTo, h.StartedAt, h.CompletedAt, h.Notes,
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskReq req, CancellationToken ct)
    {
        var t = new HousekeepingTask(req.RoomId, req.RoomNumber, req.TaskType, req.Priority, req.Notes);
        if (!string.IsNullOrEmpty(req.AssignedTo)) t.Assign(req.AssignedTo);
        db.HousekeepingTasks.Add(t); await db.SaveChangesAsync(ct);
        return CreatedAtAction(null, new { t.Id }, new { t.Id, t.Status });
    }

    [HttpPatch("{id:guid}/start")]
    public async Task<IActionResult> Start(Guid id, CancellationToken ct)
    {
        var t = await db.HousekeepingTasks.FindAsync([id], ct);
        if (t is null) return NotFound(); t.Start(); await db.SaveChangesAsync(ct);
        return Ok(new { t.Id, t.Status });
    }

    [HttpPatch("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        var t = await db.HousekeepingTasks.FindAsync([id], ct);
        if (t is null) return NotFound(); t.Complete(); await db.SaveChangesAsync(ct);
        return Ok(new { t.Id, t.Status });
    }

    [HttpPatch("{id:guid}/verify")]
    public async Task<IActionResult> Verify(Guid id, CancellationToken ct)
    {
        var t = await db.HousekeepingTasks.FindAsync([id], ct);
        if (t is null) return NotFound(); t.Verify(); await db.SaveChangesAsync(ct);
        return Ok(new { t.Id, t.Status });
    }

    public record CreateTaskReq(Guid RoomId, string RoomNumber, string TaskType, string Priority,
        string? AssignedTo, string? Notes);
}
