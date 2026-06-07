using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/sites")][Authorize]
public sealed class SitesController(ConstructionDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Sites.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.CurrentWorkers, x.SafetyScore, x.PermitExpiry }).ToListAsync(ct);
        var soon = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd");
        return Ok(new {
            total = all.Count, active = all.Count(x => x.Status == "active"),
            inactive = all.Count(x => x.Status == "inactive"), completed = all.Count(x => x.Status == "completed"),
            totalWorkers = all.Sum(x => x.CurrentWorkers),
            avgSafetyScore = all.Any() ? all.Average(x => x.SafetyScore) : 0,
            permitsExpiringSoon = all.Count(x => string.Compare(x.PermitExpiry, soon) <= 0),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Sites.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name).ToListAsync(ct);
        return Ok(items.Select(s => new {
            s.Id, s.SiteCode, s.Name, s.ProjectId, s.ProjectName,
            location = new { address = s.Address, city = s.City, emirate = s.Emirate, lat = s.Lat, lng = s.Lng },
            s.SiteManager, s.SiteManagerPhone, s.SafetyOfficer, s.SafetyOfficerPhone, s.Status,
            workers = new { current = s.CurrentWorkers, max = s.MaxWorkers },
            s.Area, s.StartDate, s.PermitNumber, s.PermitExpiry, s.LastInspection, s.NextInspection,
            s.SafetyScore, s.Notes,
        }));
    }
}
