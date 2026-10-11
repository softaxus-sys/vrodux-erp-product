using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Queries;
using Softaxis.Hospitality.API.Authorization;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/bookings")][Authorize]
public sealed class BookingsController(ISender sender) : HospitalityControllerBase
{
    [RequirePermission("hospitality.bookings.view")]
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetBookingsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [RequirePermission("hospitality.bookings.view")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetBookingsQuery(status, search, page, pageSize), ct);
        return OkOrError(result);
    }

    [RequirePermission("hospitality.bookings.create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingReq req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateBookingCommand(
            req.RoomId, req.GuestName, req.GuestEmail, req.GuestPhone, req.GuestNationality,
            req.CheckIn, req.CheckOut, req.Nights, req.Adults, req.Children, req.Source, req.SpecialRequests,
            req.PaidAmount, req.PaymentMethod), ct);
        return CreatedOrError(result);
    }

    public sealed record PaymentReq(decimal Amount, string? Method, string? Reference, string? PaidOn);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> RecordPayment(Guid id, [FromBody] PaymentReq req, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new RecordBookingPaymentCommand(id, req.Amount, req.Method, req.Reference, req.PaidOn), ct));

    [RequirePermission("hospitality.bookings.view")]
    [HttpGet("{id:guid}/payments")]
    public async Task<IActionResult> GetPayments(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBookingPaymentsQuery(id), ct));

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPatch("{id:guid}/checkin")]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CheckInBookingCommand(id), ct);
        return OkOrError(result);
    }

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPatch("{id:guid}/checkout")]
    public async Task<IActionResult> CheckOut(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CheckOutBookingCommand(id), ct);
        return OkOrError(result);
    }

    public record CreateBookingReq(Guid RoomId, string GuestName, string GuestEmail, string GuestPhone,
        string GuestNationality, string CheckIn, string CheckOut, int Nights, int Adults, int Children,
        string Source, string? SpecialRequests,
        decimal? PaidAmount = null, string? PaymentMethod = null);
}
