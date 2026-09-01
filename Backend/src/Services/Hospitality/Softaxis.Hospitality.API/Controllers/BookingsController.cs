using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Queries;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/bookings")][Authorize]
public sealed class BookingsController(ISender sender) : HospitalityControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetBookingsSummaryQuery(), ct);
        return OkOrError(result);
    }

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

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingReq req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateBookingCommand(
            req.RoomId, req.GuestName, req.GuestEmail, req.GuestPhone, req.GuestNationality,
            req.CheckIn, req.CheckOut, req.Nights, req.Adults, req.Children, req.Source, req.SpecialRequests), ct);
        return CreatedOrError(result);
    }

    [HttpPatch("{id:guid}/checkin")]
    public async Task<IActionResult> CheckIn(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CheckInBookingCommand(id), ct);
        return OkOrError(result);
    }

    [HttpPatch("{id:guid}/checkout")]
    public async Task<IActionResult> CheckOut(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CheckOutBookingCommand(id), ct);
        return OkOrError(result);
    }

    public record CreateBookingReq(Guid RoomId, string GuestName, string GuestEmail, string GuestPhone,
        string GuestNationality, string CheckIn, string CheckOut, int Nights, int Adults, int Children,
        string Source, string? SpecialRequests);
}
