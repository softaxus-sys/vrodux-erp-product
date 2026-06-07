using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/contracts")][Authorize]
public sealed class ContractsController(RealEstateDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.LeaseContracts.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.AnnualRent, x.TotalPaid, x.EndDate }).ToListAsync(ct);
        var expiringSoon = DateTime.UtcNow.AddDays(60).ToString("yyyy-MM-dd");
        return Ok(new {
            total = all.Count,
            active = all.Count(x => x.Status == "active"),
            expired = all.Count(x => x.Status == "expired"),
            terminated = all.Count(x => x.Status == "terminated"),
            totalAnnualRent = all.Sum(x => x.AnnualRent),
            totalCollected = all.Sum(x => x.TotalPaid),
            outstanding = all.Sum(x => x.AnnualRent - x.TotalPaid),
            expiringSoon = all.Count(x => x.Status == "active" && string.Compare(x.EndDate, expiringSoon) <= 0),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.LeaseContracts.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(c => new {
            c.Id, c.ContractNumber, c.PropertyId, c.PropertyName, c.UnitId, c.UnitNumber,
            c.TenantId, c.TenantName, c.StartDate, c.EndDate, c.AnnualRent, c.Cheques,
            c.SecurityDeposit, c.Status, c.TotalPaid, balance = c.Balance, c.EjariNumber, c.Notes,
        }));
    }
}
