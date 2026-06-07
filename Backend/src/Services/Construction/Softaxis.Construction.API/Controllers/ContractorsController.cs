using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/contractors")][Authorize]
public sealed class ContractorsController(ConstructionDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Contractors.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Trade, x.ActiveProjects, x.CompletedProjects, x.TotalContractValue, x.Rating }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            civil = all.Count(x => x.Trade == "civil"),
            structural = all.Count(x => x.Trade == "structural"),
            mep = all.Count(x => x.Trade == "mep"),
            totalActiveProjects = all.Sum(x => x.ActiveProjects),
            totalContractValue = all.Sum(x => x.TotalContractValue),
            avgRating = all.Any() ? all.Average(x => (double)x.Rating) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Contractors.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.CompanyName).ToListAsync(ct);
        return Ok(items.Select(c => new {
            c.Id, c.CompanyName, c.Trade, c.ContactPerson, c.Email, c.Phone, c.City,
            c.LicenseNumber, c.LicenseExpiry, c.ActiveProjects, c.CompletedProjects,
            c.TotalContractValue, c.Rating,
        }));
    }
}
