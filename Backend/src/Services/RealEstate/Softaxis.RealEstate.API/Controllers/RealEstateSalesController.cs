using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Application.Sales.Queries;

namespace Softaxis.RealEstate.API.Controllers;

/// <summary>
/// CRM-linked property sales lifecycle: Site Visits → Reservations → Bookings (+ payment plan).
/// Every record references the core CRM Lead/Deal/Customer by ID (reuse, not duplication).
/// </summary>
[ApiController][Route("api/real-estate")][Authorize]
public sealed class RealEstateSalesController(ISender sender) : RealEstateControllerBase
{
    public sealed record StatusReq(string Status);
    public sealed record FeedbackReq(string? Feedback);
    public sealed record PaymentReq(decimal Amount);

    // ── Summary (pack dashboard) ──────────────────────────────────────────────
    [HttpGet("sales/summary")]
    [RequirePermission("real-estate.sales.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetSalesSummaryQuery(), ct);
        return OkOrError(result);
    }

    // ── Site Visits ───────────────────────────────────────────────────────────
    [HttpGet("site-visits")]
    [RequirePermission("real-estate.sales.view")]
    public async Task<IActionResult> GetVisits([FromQuery] Guid? leadId, CancellationToken ct)
    {
        var result = await sender.Send(new GetSiteVisitsQuery(leadId), ct);
        return OkOrError(result);
    }

    [HttpPost("site-visits")]
    [RequirePermission("real-estate.sales.create")]
    public async Task<IActionResult> CreateVisit([FromBody] CreateSiteVisitCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPost("site-visits/{id:guid}/complete")]
    [RequirePermission("real-estate.sales.edit")]
    public async Task<IActionResult> CompleteVisit(Guid id, [FromBody] FeedbackReq req, CancellationToken ct)
    {
        var result = await sender.Send(new CompleteSiteVisitCommand(id, req.Feedback), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("site-visits/{id:guid}")]
    [RequirePermission("real-estate.sales.delete")]
    public async Task<IActionResult> DeleteVisit(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteSiteVisitCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Reservations ──────────────────────────────────────────────────────────
    [HttpGet("reservations")]
    [RequirePermission("real-estate.sales.view")]
    public async Task<IActionResult> GetReservations(CancellationToken ct)
    {
        var result = await sender.Send(new GetReservationsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("reservations")]
    [RequirePermission("real-estate.sales.create")]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPatch("reservations/{id:guid}/status")]
    [RequirePermission("real-estate.sales.edit")]
    public async Task<IActionResult> ReservationStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new SetReservationStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("reservations/{id:guid}")]
    [RequirePermission("real-estate.sales.delete")]
    public async Task<IActionResult> DeleteReservation(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteReservationCommand(id), ct);
        return NoContentOrError(result);
    }

    // ── Bookings ──────────────────────────────────────────────────────────────
    [HttpGet("bookings")]
    [RequirePermission("real-estate.sales.view")]
    public async Task<IActionResult> GetBookings(CancellationToken ct)
    {
        var result = await sender.Send(new GetBookingsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("bookings")]
    [RequirePermission("real-estate.sales.create")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return OkOrError(result);
    }

    [HttpPost("bookings/{id:guid}/payment")]
    [RequirePermission("real-estate.sales.edit")]
    public async Task<IActionResult> RecordPayment(Guid id, [FromBody] PaymentReq req, CancellationToken ct)
    {
        var result = await sender.Send(new RecordBookingPaymentCommand(id, req.Amount), ct);
        return OkOrError(result);
    }

    [HttpPatch("bookings/{id:guid}/status")]
    [RequirePermission("real-estate.sales.edit")]
    public async Task<IActionResult> BookingStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new SetBookingStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("bookings/{id:guid}")]
    [RequirePermission("real-estate.sales.delete")]
    public async Task<IActionResult> DeleteBooking(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteBookingCommand(id), ct);
        return NoContentOrError(result);
    }
}
