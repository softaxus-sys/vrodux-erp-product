using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// CRM-linked property sales lifecycle: Site Visits → Reservations → Bookings (+ payment plan).
/// Every record references the core CRM Lead/Deal/Customer by ID (reuse, not duplication).
/// </summary>
[ApiController][Route("api/real-estate")][Authorize]
public sealed class RealEstateSalesController(RealEstateDbContext db) : ControllerBase
{
    // ── Summary (pack dashboard) ──────────────────────────────────────────────
    [HttpGet("sales/summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var visits = await db.SiteVisits.AsNoTracking().CountAsync(ct);
        var resv   = await db.Reservations.AsNoTracking().Where(x => x.Status == "active").CountAsync(ct);
        var bookings = await db.Bookings.AsNoTracking().Select(b => new { b.SalePrice, b.PaidAmount, b.Status }).ToListAsync(ct);
        return Ok(new
        {
            siteVisits        = visits,
            activeReservations= resv,
            bookings          = bookings.Count,
            bookedValue       = bookings.Sum(b => b.SalePrice),
            collected         = bookings.Sum(b => b.PaidAmount),
            outstanding       = bookings.Sum(b => Math.Max(0, b.SalePrice - b.PaidAmount)),
            inHandover        = bookings.Count(b => b.Status == "handover"),
        });
    }

    // ── Site Visits ───────────────────────────────────────────────────────────
    [HttpGet("site-visits")]
    public async Task<IActionResult> GetVisits([FromQuery] Guid? leadId, CancellationToken ct)
    {
        var q = db.SiteVisits.AsNoTracking().AsQueryable();
        if (leadId.HasValue) q = q.Where(x => x.LeadId == leadId.Value);
        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(VisitDto));
    }

    [HttpPost("site-visits")]
    public async Task<IActionResult> CreateVisit([FromBody] CreateVisitReq r, CancellationToken ct)
    {
        var v = new SiteVisit(r.LeadId, r.CustomerId, r.CustomerName, r.PropertyId, r.UnitId, r.ScheduledAt, r.AssignedTo ?? "", r.Notes);
        db.SiteVisits.Add(v); await db.SaveChangesAsync(ct);
        return Ok(VisitDto(v));
    }

    [HttpPost("site-visits/{id:guid}/complete")]
    public async Task<IActionResult> CompleteVisit(Guid id, [FromBody] FeedbackReq r, CancellationToken ct)
    {
        var v = await db.SiteVisits.FindAsync([id], ct); if (v is null) return NotFound();
        v.Complete(r.Feedback); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("site-visits/{id:guid}")]
    public async Task<IActionResult> DeleteVisit(Guid id, CancellationToken ct)
    {
        var v = await db.SiteVisits.FindAsync([id], ct); if (v is null) return NotFound();
        v.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    // ── Reservations ──────────────────────────────────────────────────────────
    [HttpGet("reservations")]
    public async Task<IActionResult> GetReservations(CancellationToken ct)
    {
        var items = await db.Reservations.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(ResvDto));
    }

    [HttpPost("reservations")]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationReq r, CancellationToken ct)
    {
        var res = new Reservation(r.LeadId, r.DealId, r.CustomerId, r.CustomerName, r.PropertyId, r.UnitId,
            r.ReservationDate, r.ExpiryDate, r.TokenAmount, r.Notes);
        db.Reservations.Add(res); await db.SaveChangesAsync(ct);
        return Ok(ResvDto(res));
    }

    [HttpPatch("reservations/{id:guid}/status")]
    public async Task<IActionResult> ReservationStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var res = await db.Reservations.FindAsync([id], ct); if (res is null) return NotFound();
        res.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("reservations/{id:guid}")]
    public async Task<IActionResult> DeleteReservation(Guid id, CancellationToken ct)
    {
        var res = await db.Reservations.FindAsync([id], ct); if (res is null) return NotFound();
        res.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    // ── Bookings ──────────────────────────────────────────────────────────────
    [HttpGet("bookings")]
    public async Task<IActionResult> GetBookings(CancellationToken ct)
    {
        var items = await db.Bookings.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(items.Select(BookingDto));
    }

    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingReq r, CancellationToken ct)
    {
        var b = new Booking(r.DealId, r.CustomerId, r.CustomerName, r.PropertyId, r.UnitId,
            r.BookingDate, r.SalePrice, r.DownPayment, r.InstallmentCount, r.Broker, r.Notes);
        db.Bookings.Add(b);
        // Convert any active reservation on this unit
        var resv = await db.Reservations.Where(x => x.UnitId == r.UnitId && x.Status == "active").ToListAsync(ct);
        foreach (var res in resv) res.SetStatus("converted");
        await db.SaveChangesAsync(ct);
        return Ok(BookingDto(b));
    }

    [HttpPost("bookings/{id:guid}/payment")]
    public async Task<IActionResult> RecordPayment(Guid id, [FromBody] PaymentReq r, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([id], ct); if (b is null) return NotFound();
        b.RecordPayment(r.Amount); await db.SaveChangesAsync(ct); return Ok(BookingDto(b));
    }

    [HttpPatch("bookings/{id:guid}/status")]
    public async Task<IActionResult> BookingStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([id], ct); if (b is null) return NotFound();
        b.SetStatus(r.Status); await db.SaveChangesAsync(ct); return NoContent();
    }

    [HttpDelete("bookings/{id:guid}")]
    public async Task<IActionResult> DeleteBooking(Guid id, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([id], ct); if (b is null) return NotFound();
        b.Delete(); await db.SaveChangesAsync(ct); return NoContent();
    }

    // ── DTOs & requests ───────────────────────────────────────────────────────
    private static object VisitDto(SiteVisit v) => new {
        v.Id, v.VisitNumber, v.LeadId, v.CustomerId, v.CustomerName, v.PropertyId, v.UnitId,
        v.ScheduledAt, v.Status, v.Feedback, v.AssignedTo, v.Notes, v.CreatedAt };
    private static object ResvDto(Reservation x) => new {
        x.Id, x.ReservationNumber, x.LeadId, x.DealId, x.CustomerId, x.CustomerName, x.PropertyId, x.UnitId,
        x.ReservationDate, x.ExpiryDate, x.TokenAmount, x.Status, x.Notes, x.CreatedAt };
    private static object BookingDto(Booking b) => new {
        b.Id, b.BookingNumber, b.DealId, b.CustomerId, b.CustomerName, b.PropertyId, b.UnitId, b.BookingDate,
        b.SalePrice, b.DownPayment, b.InstallmentCount, b.InstallmentAmount, b.PaidAmount, b.Balance,
        b.Status, b.Broker, b.Notes, b.CreatedAt };

    public record CreateVisitReq(Guid? LeadId, Guid? CustomerId, string CustomerName, Guid PropertyId, Guid? UnitId, string ScheduledAt, string? AssignedTo, string? Notes);
    public record FeedbackReq(string? Feedback);
    public record CreateReservationReq(Guid? LeadId, Guid? DealId, Guid? CustomerId, string CustomerName, Guid PropertyId, Guid UnitId, string ReservationDate, string ExpiryDate, decimal TokenAmount, string? Notes);
    public record CreateBookingReq(Guid? DealId, Guid? CustomerId, string CustomerName, Guid PropertyId, Guid UnitId, string BookingDate, decimal SalePrice, decimal DownPayment, int InstallmentCount, string? Broker, string? Notes);
    public record StatusReq(string Status);
    public record PaymentReq(decimal Amount);
}
