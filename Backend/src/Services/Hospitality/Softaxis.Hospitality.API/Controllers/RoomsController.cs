using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/rooms")][Authorize]
public sealed class RoomsController(HospitalityDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Rooms.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.HousekeepingStatus, x.RoomType, x.RatePerNight }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            available = all.Count(x => x.Status == "available"),
            occupied = all.Count(x => x.Status == "occupied"),
            maintenance = all.Count(x => x.Status == "maintenance"),
            cleaning = all.Count(x => x.Status == "cleaning"),
            occupancyRate = all.Count > 0 ? Math.Round((double)all.Count(x => x.Status == "occupied") / all.Count * 100, 1) : 0,
            dirtyRooms = all.Count(x => x.HousekeepingStatus == "dirty"),
            avgRate = all.Any() ? all.Average(x => (double)x.RatePerNight) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Rooms.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Floor).ThenBy(x => x.RoomNumber).ToListAsync(ct);
        return Ok(items.Select(r => new {
            r.Id, r.RoomNumber, r.RoomType, r.Floor, r.Capacity, r.RatePerNight,
            r.Status, r.HousekeepingStatus, r.CurrentGuestName, r.CurrentBookingId,
            r.View, r.HasBalcony,
        }));
    }
}
