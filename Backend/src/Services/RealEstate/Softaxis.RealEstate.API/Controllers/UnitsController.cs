using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/units")][Authorize]
public sealed class UnitsController(RealEstateDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.PropertyUnits.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.UnitType, x.RentPerYear }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            vacant = all.Count(x => x.Status == "vacant"),
            rented = all.Count(x => x.Status == "rented"),
            sold = all.Count(x => x.Status == "sold"),
            maintenance = all.Count(x => x.Status == "maintenance"),
            totalAnnualRent = all.Where(x => x.Status == "rented").Sum(x => x.RentPerYear),
            occupancyRate = all.Count > 0 ? Math.Round((double)all.Count(x => x.Status == "rented") / all.Count * 100, 1) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? propertyId, CancellationToken ct)
    {
        var q = db.PropertyUnits.AsNoTracking().Where(x => !x.IsDeleted);
        if (propertyId.HasValue) q = q.Where(x => x.PropertyId == propertyId.Value);
        var items = await q.OrderBy(x => x.UnitNumber).ToListAsync(ct);
        return Ok(items.Select(u => new {
            u.Id, u.PropertyId, u.UnitNumber, u.UnitType, u.Area, u.Floor,
            u.RentPerYear, u.SalePrice, u.Status, u.CurrentTenantId, u.CurrentTenantName,
        }));
    }
}
