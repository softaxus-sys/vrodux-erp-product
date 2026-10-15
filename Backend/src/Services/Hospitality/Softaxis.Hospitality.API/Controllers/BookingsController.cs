using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Authorization;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Queries;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/bookings")][Authorize]
public sealed class BookingsController(ISender sender) : HospitalityControllerBase
{
    [RequirePermission("hospitality.bookings.view")]
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBookingsSummaryQuery(), ct));

    [RequirePermission("hospitality.bookings.view")]
    [HttpGet("front-desk")]
    public async Task<IActionResult> FrontDesk([FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFrontDeskQuery(today), ct));

    [RequirePermission("hospitality.bookings.view", "hospitality.guests.view")]
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status = null, [FromQuery] string? search = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 30,
        [FromQuery] string? from = null, [FromQuery] string? to = null, [FromQuery] Guid? guestId = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetBookingsQuery(status, search, page, pageSize, from, to, guestId), ct));

    [RequirePermission("hospitality.bookings.view")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBookingByIdQuery(id), ct));

    [RequirePermission("hospitality.bookings.create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBookingCommand cmd, CancellationToken ct) =>
        CreatedOrError(await sender.Send(cmd, ct));

    public sealed record DetailsReq(string GuestName, string? GuestEmail, string? GuestPhone, string? GuestNationality,
        int Adults, int Children, string Source, string? SpecialRequests, string? Notes);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateDetails(Guid id, [FromBody] DetailsReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateBookingDetailsCommand(id, r.GuestName, r.GuestEmail, r.GuestPhone,
            r.GuestNationality, r.Adults, r.Children, r.Source, r.SpecialRequests, r.Notes), ct));

    public sealed record DatesReq(string CheckIn, string CheckOut);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPost("{id:guid}/amend")]
    public async Task<IActionResult> Amend(Guid id, [FromBody] DatesReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new AmendStayCommand(id, r.CheckIn, r.CheckOut), ct));

    public sealed record MoveReq(Guid RoomId, bool Reprice = false);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, [FromBody] MoveReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new MoveRoomCommand(id, r.RoomId, r.Reprice), ct));

    public sealed record CancelReq(string Reason, decimal? CancellationFee = null);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new CancelBookingCommand(id, r.Reason, r.CancellationFee), ct));

    public sealed record NoShowReq(string? Today = null, decimal? Fee = null);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPost("{id:guid}/no-show")]
    public async Task<IActionResult> NoShow(Guid id, [FromBody] NoShowReq? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkNoShowCommand(id, r?.Today, r?.Fee), ct));

    public sealed record CheckInReq(string? Today = null, Guid? RoomId = null);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPatch("{id:guid}/checkin")]
    public async Task<IActionResult> CheckIn(Guid id, [FromBody] CheckInReq? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new CheckInBookingCommand(id, r?.Today, r?.RoomId), ct));

    public sealed record CheckOutReq(string? Today = null, bool AllowBalance = false);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPatch("{id:guid}/checkout")]
    public async Task<IActionResult> CheckOut(Guid id, [FromBody] CheckOutReq? r, CancellationToken ct) =>
        OkOrError(await sender.Send(new CheckOutBookingCommand(id, r?.Today, r?.AllowBalance ?? false), ct));

    // ── Payments ─────────────────────────────────────────────────────────────

    public sealed record PaymentReq(decimal Amount, string? Method, string? Reference, string? PaidOn);

    [RequirePermission("hospitality.bookings.edit")]
    [HttpPost("{id:guid}/payments")]
    public async Task<IActionResult> RecordPayment(Guid id, [FromBody] PaymentReq req, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new RecordBookingPaymentCommand(id, req.Amount, req.Method, req.Reference, req.PaidOn), ct));

    [RequirePermission("hospitality.bookings.view")]
    [HttpGet("{id:guid}/payments")]
    public async Task<IActionResult> GetPayments(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetBookingPaymentsQuery(id), ct));

    // ── Folio ────────────────────────────────────────────────────────────────

    [RequirePermission("hospitality.bookings.view", "hospitality.folio.view")]
    [HttpGet("{id:guid}/folio")]
    public async Task<IActionResult> GetFolio(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFolioQuery(id), ct));

    public sealed record ChargeReq(string Category, string Description, decimal Quantity, decimal UnitPrice, string? Date, string? PostedBy);

    [RequirePermission("hospitality.folio.create")]
    [HttpPost("{id:guid}/folio/charges")]
    public async Task<IActionResult> PostCharge(Guid id, [FromBody] ChargeReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new PostFolioChargeCommand(id, r.Category, r.Description, r.Quantity, r.UnitPrice, r.Date, r.PostedBy), ct));

    public sealed record VoidReq(string Reason);

    [RequirePermission("hospitality.folio.approve")]
    [HttpPost("{id:guid}/folio/charges/{chargeId:guid}/void")]
    public async Task<IActionResult> VoidCharge(Guid id, Guid chargeId, [FromBody] VoidReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new VoidFolioChargeCommand(id, chargeId, r.Reason), ct));

    public sealed record DiscountReq(decimal Amount, string? Reason);

    [RequirePermission("hospitality.folio.approve")]
    [HttpPut("{id:guid}/folio/discount")]
    public async Task<IActionResult> SetDiscount(Guid id, [FromBody] DiscountReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetBookingDiscountCommand(id, r.Amount, r.Reason), ct));
}
