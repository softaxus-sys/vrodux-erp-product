using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Authorization;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Tours;

namespace Softaxis.Hospitality.API.Controllers;

/// <summary>Travel agency / tour operator: packages, departures, bookings, suppliers, payments.</summary>
[ApiController][Route("api/hospitality/tours")][Authorize]
public sealed class ToursController(ISender sender) : HospitalityControllerBase
{
    /// <summary>Supplier costs and margin are shown only to holders of hospitality.tour-costs.view.</summary>
    private bool CanSeeCosts =>
        User.FindFirst("is_super_admin")?.Value == "true" ||
        User.FindAll("permission").Any(c => c.Value == "hospitality.tour-costs.view");

    private string? UserName =>
        User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Email)?.Value;

    // ── Dashboard ──
    [RequirePermission("hospitality.tour-bookings.view")]
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard([FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTourDashboardQuery(CanSeeCosts, today), ct));

    // ── Packages ──
    [RequirePermission("hospitality.tours.view", "hospitality.tour-bookings.create")]
    [HttpGet("packages")]
    public async Task<IActionResult> Packages([FromQuery] string? search, [FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetTourPackagesQuery(search, includeInactive), ct));

    [RequirePermission("hospitality.tours.view", "hospitality.tour-bookings.view")]
    [HttpGet("packages/{id:guid}")]
    public async Task<IActionResult> Package(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTourPackageByIdQuery(id), ct));

    [RequirePermission("hospitality.tours.create")]
    [HttpPost("packages")]
    public async Task<IActionResult> CreatePackage([FromBody] UpsertTourPackageCommand cmd, CancellationToken ct) =>
        CreatedOrError(await sender.Send(cmd with { Id = null }, ct));

    [RequirePermission("hospitality.tours.edit")]
    [HttpPut("packages/{id:guid}")]
    public async Task<IActionResult> UpdatePackage(Guid id, [FromBody] UpsertTourPackageCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = id }, ct));

    [RequirePermission("hospitality.tours.delete")]
    [HttpDelete("packages/{id:guid}")]
    public async Task<IActionResult> DeletePackage(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteTourPackageCommand(id), ct));

    // ── Departures ──
    [RequirePermission("hospitality.tours.view", "hospitality.tour-bookings.view")]
    [HttpGet("departures")]
    public async Task<IActionResult> Departures([FromQuery] Guid? packageId, [FromQuery] string? from, [FromQuery] string? to,
        [FromQuery] bool includeClosed = true, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetTourDeparturesQuery(packageId, from, to, includeClosed), ct));

    [RequirePermission("hospitality.tours.create")]
    [HttpPost("departures")]
    public async Task<IActionResult> CreateDeparture([FromBody] UpsertTourDepartureCommand cmd, CancellationToken ct) =>
        CreatedOrError(await sender.Send(cmd with { Id = null }, ct));

    [RequirePermission("hospitality.tours.edit")]
    [HttpPut("departures/{id:guid}")]
    public async Task<IActionResult> UpdateDeparture(Guid id, [FromBody] UpsertTourDepartureCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = id }, ct));

    public sealed record StatusReq(string Status);

    [RequirePermission("hospitality.tours.edit")]
    [HttpPatch("departures/{id:guid}/status")]
    public async Task<IActionResult> DepartureStatus(Guid id, [FromBody] StatusReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetTourDepartureStatusCommand(id, r.Status), ct));

    [RequirePermission("hospitality.tours.delete")]
    [HttpDelete("departures/{id:guid}")]
    public async Task<IActionResult> DeleteDeparture(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteTourDepartureCommand(id), ct));

    // ── Bookings ──
    [RequirePermission("hospitality.tour-bookings.view")]
    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings(
        [FromQuery] string? status = null, [FromQuery] string? search = null, [FromQuery] Guid? departureId = null,
        [FromQuery] Guid? guestId = null, [FromQuery] string? from = null, [FromQuery] string? to = null,
        [FromQuery] bool balanceOnly = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 30,
        [FromQuery] string? today = null, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetTourBookingsQuery(status, search, departureId, guestId, from, to, balanceOnly,
            page, pageSize, CanSeeCosts, today), ct));

    [RequirePermission("hospitality.tour-bookings.view")]
    [HttpGet("bookings/{id:guid}")]
    public async Task<IActionResult> Booking(Guid id, [FromQuery] string? today, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetTourBookingByIdQuery(id, CanSeeCosts, today), ct));

    [RequirePermission("hospitality.tour-bookings.create")]
    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateTourBookingCommand cmd, CancellationToken ct) =>
        CreatedOrError(await sender.Send(cmd with { CreatedByName = UserName }, ct));

    [RequirePermission("hospitality.tour-bookings.edit")]
    [HttpPut("bookings/{id:guid}")]
    public async Task<IActionResult> UpdateBooking(Guid id, [FromBody] UpdateTourBookingCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd with { Id = id }, ct));

    public sealed record ActionReq(string Action, string? Reason);

    [RequirePermission("hospitality.tour-bookings.edit")]
    [HttpPost("bookings/{id:guid}/status")]
    public async Task<IActionResult> BookingStatus(Guid id, [FromBody] ActionReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetTourBookingStatusCommand(id, r.Action, r.Reason), ct));

    [RequirePermission("hospitality.tour-bookings.delete")]
    [HttpDelete("bookings/{id:guid}")]
    public async Task<IActionResult> DeleteBooking(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteTourBookingCommand(id), ct));

    public sealed record TravellersReq(IReadOnlyList<TravellerInput> Travellers);

    [RequirePermission("hospitality.tour-bookings.edit")]
    [HttpPut("bookings/{id:guid}/travellers")]
    public async Task<IActionResult> Travellers(Guid id, [FromBody] TravellersReq r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SaveTourTravellersCommand(id, r.Travellers), ct));

    public sealed record ServiceReq(string Type, string SupplierName, string Description, string? ServiceDate, string? EndDate,
        string? ConfirmationNumber, decimal Cost, decimal SupplierPaid, bool IsExtra, decimal SellPrice, string Status, string? Notes);

    // Supplier bookings carry costs, so writing them needs the cost permission as well as edit.
    [RequirePermission("hospitality.tour-costs.edit")]
    [HttpPost("bookings/{id:guid}/services")]
    public async Task<IActionResult> AddService(Guid id, [FromBody] ServiceReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new UpsertTourServiceCommand(id, null, r.Type, r.SupplierName, r.Description, r.ServiceDate,
            r.EndDate, r.ConfirmationNumber, r.Cost, r.SupplierPaid, r.IsExtra, r.SellPrice, r.Status, r.Notes), ct));

    [RequirePermission("hospitality.tour-costs.edit")]
    [HttpPut("bookings/{id:guid}/services/{serviceId:guid}")]
    public async Task<IActionResult> UpdateService(Guid id, Guid serviceId, [FromBody] ServiceReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertTourServiceCommand(id, serviceId, r.Type, r.SupplierName, r.Description, r.ServiceDate,
            r.EndDate, r.ConfirmationNumber, r.Cost, r.SupplierPaid, r.IsExtra, r.SellPrice, r.Status, r.Notes), ct));

    [RequirePermission("hospitality.tour-costs.edit")]
    [HttpDelete("bookings/{id:guid}/services/{serviceId:guid}")]
    public async Task<IActionResult> DeleteService(Guid id, Guid serviceId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteTourServiceCommand(id, serviceId), ct));

    public sealed record InstalmentsReq(IReadOnlyList<InstalmentInput> Instalments);

    [RequirePermission("hospitality.tour-bookings.edit")]
    [HttpPut("bookings/{id:guid}/instalments")]
    public async Task<IActionResult> Instalments(Guid id, [FromBody] InstalmentsReq r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SaveTourInstalmentsCommand(id, r.Instalments), ct));

    public sealed record PaymentReq(decimal Amount, string Method, string? Reference, string? PaidOn);

    [RequirePermission("hospitality.tour-bookings.record")]
    [HttpPost("bookings/{id:guid}/payments")]
    public async Task<IActionResult> AddPayment(Guid id, [FromBody] PaymentReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new AddTourPaymentCommand(id, r.Amount, r.Method, r.Reference, r.PaidOn, UserName), ct));

    public sealed record VoidReq(string Reason);

    [RequirePermission("hospitality.tour-bookings.void")]
    [HttpPost("bookings/{id:guid}/payments/{paymentId:guid}/void")]
    public async Task<IActionResult> VoidPayment(Guid id, Guid paymentId, [FromBody] VoidReq r, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new VoidTourPaymentCommand(id, paymentId, r.Reason), ct));
}
