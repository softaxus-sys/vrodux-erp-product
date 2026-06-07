using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/properties")][Authorize]
public sealed class PropertiesController(RealEstateDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Properties.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.TotalUnits, x.OccupiedUnits, x.MarketValue, x.PropertyType }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            residential = all.Count(x => x.PropertyType == "residential"),
            commercial = all.Count(x => x.PropertyType == "commercial"),
            mixed = all.Count(x => x.PropertyType == "mixed"),
            totalUnits = all.Sum(x => x.TotalUnits),
            occupiedUnits = all.Sum(x => x.OccupiedUnits),
            occupancyRate = all.Sum(x => x.TotalUnits) > 0
                ? Math.Round((double)all.Sum(x => x.OccupiedUnits) / all.Sum(x => x.TotalUnits) * 100, 1) : 0,
            totalMarketValue = all.Sum(x => x.MarketValue),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Properties.AsNoTracking().Include(x => x.Units)
            .Where(x => !x.IsDeleted).OrderBy(x => x.Name).ToListAsync(ct);
        return Ok(items.Select(p => new {
            p.Id, p.PropertyNumber, p.Name, p.PropertyType, p.Status,
            location = new { p.Address, p.City, p.Emirate },
            p.TotalArea, p.TotalUnits, p.OccupiedUnits, p.MarketValue, p.Developer, p.Description,
            occupancyRate = p.TotalUnits > 0 ? Math.Round((double)p.OccupiedUnits / p.TotalUnits * 100, 1) : 0,
            units = p.Units.Where(u => !u.IsDeleted).Select(u => new {
                u.Id, u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice, u.Status,
                u.CurrentTenantId, u.CurrentTenantName,
            }),
        }));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var p = await db.Properties.AsNoTracking().Include(x => x.Units)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return NotFound();
        return Ok(new {
            p.Id, p.PropertyNumber, p.Name, p.PropertyType, p.Status,
            location = new { p.Address, p.City, p.Emirate },
            p.TotalArea, p.TotalUnits, p.OccupiedUnits, p.MarketValue, p.Developer, p.Description,
            units = p.Units.Where(u => !u.IsDeleted).Select(u => new {
                u.Id, u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice, u.Status,
                u.CurrentTenantId, u.CurrentTenantName,
            }),
        });
    }
}
