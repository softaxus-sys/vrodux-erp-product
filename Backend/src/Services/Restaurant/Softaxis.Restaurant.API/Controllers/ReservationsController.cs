using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/reservations")][Authorize]
public sealed class ReservationsController(RestaurantDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var all = await db.Reservations.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.ReservationDate, x.Covers }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            confirmed = all.Count(x => x.Status == "confirmed"),
            seated    = all.Count(x => x.Status == "seated"),
            completed = all.Count(x => x.Status == "completed"),
            cancelled = all.Count(x => x.Status == "cancelled"),
            noShow    = all.Count(x => x.Status == "no_show"),
            today     = all.Count(x => x.ReservationDate == today),
            todayCovers = all.Where(x => x.ReservationDate == today && x.Status != "cancelled").Sum(x => x.Covers),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? date, CancellationToken ct)
    {
        var q = db.Reservations.AsNoTracking().Where(x => !x.IsDeleted);
        if (!string.IsNullOrEmpty(date)) q = q.Where(x => x.ReservationDate == date);
        var items = await q.OrderBy(x => x.ReservationDate).ThenBy(x => x.ReservationTime).ToListAsync(ct);
        return Ok(items.Select(r => new {
            r.Id, r.ReservationNumber, r.TableId, r.TableNumber,
            r.GuestName, r.GuestPhone, r.GuestEmail, r.Covers,
            r.ReservationDate, r.ReservationTime, r.Status, r.SpecialRequests,
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReservationReq req, CancellationToken ct)
    {
        var r = new Reservation(req.GuestName, req.GuestPhone, req.GuestEmail, req.Covers,
            req.ReservationDate, req.ReservationTime, req.SpecialRequests);
        if (req.TableId.HasValue)
        {
            var table = await db.Tables.FindAsync([req.TableId.Value], ct);
            if (table is not null) { r.AssignTable(table.Id, table.TableNumber); table.Reserve(); }
        }
        db.Reservations.Add(r);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(null, new { r.Id }, new { r.Id, r.ReservationNumber, r.Status });
    }

    [HttpPatch("{id:guid}/seat")]
    public async Task<IActionResult> Seat(Guid id, CancellationToken ct)
    {
        var r = await db.Reservations.FindAsync([id], ct);
        if (r is null) return NotFound(); r.Seat(); await db.SaveChangesAsync(ct);
        return Ok(new { r.Id, r.Status });
    }

    [HttpPatch("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var r = await db.Reservations.FindAsync([id], ct);
        if (r is null) return NotFound(); r.Cancel(); await db.SaveChangesAsync(ct);
        return Ok(new { r.Id, r.Status });
    }

    public record CreateReservationReq(string GuestName, string GuestPhone, string? GuestEmail,
        int Covers, string ReservationDate, string ReservationTime, string? SpecialRequests, Guid? TableId);
}
