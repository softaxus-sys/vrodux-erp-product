using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/bookings")][Authorize]
public sealed class BookingsController(HospitalityDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Bookings.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.TotalAmount, x.PaidAmount, x.Source }).ToListAsync(ct);
        return Ok(new {
            total = all.Count,
            confirmed = all.Count(x => x.Status == "confirmed"),
            checkedIn = all.Count(x => x.Status == "checked_in"),
            checkedOut = all.Count(x => x.Status == "checked_out"),
            cancelled = all.Count(x => x.Status == "cancelled"),
            totalRevenue = all.Where(x => x.Status != "cancelled").Sum(x => x.TotalAmount),
            totalCollected = all.Sum(x => x.PaidAmount),
            outstanding = all.Where(x => x.Status != "cancelled").Sum(x => x.TotalAmount - x.PaidAmount),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.Bookings.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(b => new {
            b.Id, b.BookingNumber, b.RoomId, b.RoomNumber, b.RoomType,
            b.GuestName, b.GuestEmail, b.GuestPhone, b.GuestNationality,
            b.CheckIn, b.CheckOut, b.Nights, b.Adults, b.Children,
            b.RatePerNight, b.TotalAmount, b.PaidAmount, balance = b.Balance,
            b.Status, b.Source, b.SpecialRequests,
        }));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingReq req, CancellationToken ct)
    {
        var room = await db.Rooms.FindAsync([req.RoomId], ct);
        if (room is null) return NotFound("Room not found");
        var b = new Booking(req.RoomId, room.RoomNumber, room.RoomType, req.GuestName, req.GuestEmail,
            req.GuestPhone, req.GuestNationality, req.CheckIn, req.CheckOut, req.Nights,
            req.Adults, req.Children, room.RatePerNight, req.Source, req.SpecialRequests);
        db.Bookings.Add(b); await db.SaveChangesAsync(ct);
        return CreatedAtAction(null, new { b.Id }, new { b.Id, b.BookingNumber, b.TotalAmount });
    }

    [HttpPatch("{id:guid}/checkin")]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        var b = await db.Bookings.Include(_ => default(object)).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (b is null) return NotFound();
        var room = await db.Rooms.FindAsync([b.RoomId], ct);
        b.DoCheckIn(); room?.CheckIn(b.GuestName, b.BookingNumber);
        await db.SaveChangesAsync(ct); return Ok(new { b.Id, b.Status });
    }

    [HttpPatch("{id:guid}/checkout")]
    public async Task<IActionResult> CheckOut(Guid id, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([id], ct);
        if (b is null) return NotFound();
        var room = await db.Rooms.FindAsync([b.RoomId], ct);
        b.DoCheckOut(); room?.CheckOut();
        await db.SaveChangesAsync(ct); return Ok(new { b.Id, b.Status });
    }

    public record CreateBookingReq(Guid RoomId, string GuestName, string GuestEmail, string GuestPhone,
        string GuestNationality, string CheckIn, string CheckOut, int Nights, int Adults, int Children,
        string Source, string? SpecialRequests);
}
