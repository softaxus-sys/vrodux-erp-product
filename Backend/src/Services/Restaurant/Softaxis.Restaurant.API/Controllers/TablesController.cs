using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/tables")][Authorize]
public sealed class TablesController(RestaurantDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Tables.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Section, x.Capacity }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            available = all.Count(x => x.Status == "available"),
            occupied  = all.Count(x => x.Status == "occupied"),
            reserved  = all.Count(x => x.Status == "reserved"),
            cleaning  = all.Count(x => x.Status == "cleaning"),
            occupancyRate = all.Count > 0
                ? Math.Round((double)all.Count(x => x.Status == "occupied") / all.Count * 100, 1) : 0,
            totalCovers = all.Sum(x => x.Capacity),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Tables.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Section).ThenBy(x => x.TableNumber).ToListAsync(ct);
        return Ok(items.Select(t => new {
            t.Id, t.TableNumber, t.Section, t.Capacity, t.Status,
            t.CurrentOrderId, t.CurrentWaiter, t.OccupiedSince,
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTableReq req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.TableNumber)) return BadRequest("Table number is required.");
        if (req.Capacity <= 0) return BadRequest("Capacity must be greater than zero.");

        var exists = await db.Tables.AnyAsync(x => !x.IsDeleted && x.TableNumber == req.TableNumber, ct);
        if (exists) return Conflict($"Table '{req.TableNumber}' already exists.");

        var table = new Softaxis.Restaurant.Domain.Entities.Table(req.TableNumber.Trim(), req.Section, req.Capacity);
        db.Tables.Add(table);
        await db.SaveChangesAsync(ct);
        return Ok(new { table.Id, table.TableNumber, table.Section, table.Capacity, table.Status });
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusReq req, CancellationToken ct)
    {
        var t = await db.Tables.FindAsync([id], ct);
        if (t is null) return NotFound();
        switch (req.Status)
        {
            case "available": t.SetAvailable(); break;
            case "reserved":  t.Reserve(); break;
            case "cleaning":  t.Free(); break;
            default: return BadRequest("Invalid status");
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { t.Id, t.Status });
    }

    public record UpdateStatusReq(string Status);
    public record CreateTableReq(string TableNumber, string Section, int Capacity);
}
