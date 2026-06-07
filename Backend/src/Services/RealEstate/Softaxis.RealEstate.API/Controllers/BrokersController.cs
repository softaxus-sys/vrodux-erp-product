using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/brokers")][Authorize]
public sealed class BrokersController(RealEstateDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Brokers.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Specialization, x.DealsCompleted, x.TotalCommission, x.Rating }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            residential = all.Count(x => x.Specialization == "residential"),
            commercial = all.Count(x => x.Specialization == "commercial"),
            both = all.Count(x => x.Specialization == "both"),
            totalDeals = all.Sum(x => x.DealsCompleted),
            totalCommission = all.Sum(x => x.TotalCommission),
            avgRating = all.Any() ? all.Average(x => (double)x.Rating) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Brokers.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.DealsCompleted).ToListAsync(ct);
        return Ok(items.Select(b => new {
            b.Id, b.BrokerNumber, b.Name, b.Agency, b.Email, b.Phone,
            b.LicenseNumber, b.LicenseExpiry, b.Specialization,
            b.DealsCompleted, b.TotalCommission, b.CommissionRate, b.Rating, b.Status,
        }));
    }
}
