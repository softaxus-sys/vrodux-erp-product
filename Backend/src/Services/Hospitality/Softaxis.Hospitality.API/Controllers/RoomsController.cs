using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Authorization;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Rooms.Commands;
using Softaxis.Hospitality.Application.Rooms.Queries;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/rooms")][Authorize]
public sealed class RoomsController(ISender sender) : HospitalityControllerBase
{
    [RequirePermission("hospitality.rooms.view")]
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetRoomsSummaryQuery(), ct));

    [RequirePermission("hospitality.rooms.view", "hospitality.bookings.create", "hospitality.bookings.edit")]
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetRoomsQuery(), ct));

    public sealed record RoomReq(string RoomNumber, Guid RoomTypeId, int Floor, int Capacity, decimal RatePerNight,
        string? View, bool HasBalcony, string? Notes);

    [RequirePermission("hospitality.rooms.create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] RoomReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new UpsertRoomCommand(null, r.RoomNumber, r.RoomTypeId, r.Floor, r.Capacity,
            r.RatePerNight, r.View, r.HasBalcony, r.Notes), ct));

    [RequirePermission("hospitality.rooms.edit")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] RoomReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertRoomCommand(id, r.RoomNumber, r.RoomTypeId, r.Floor, r.Capacity,
            r.RatePerNight, r.View, r.HasBalcony, r.Notes), ct));

    [RequirePermission("hospitality.rooms.delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteRoomCommand(id), ct));

    public sealed record MaintenanceReq(bool InMaintenance);

    [RequirePermission("hospitality.rooms.edit")]
    [HttpPatch("{id:guid}/maintenance")]
    public async Task<IActionResult> SetMaintenance(Guid id, [FromBody] MaintenanceReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetRoomMaintenanceCommand(id, r.InMaintenance), ct));

    public sealed record HousekeepingReq(string Status);

    [RequirePermission("hospitality.rooms.edit", "hospitality.housekeeping.edit")]
    [HttpPatch("{id:guid}/housekeeping")]
    public async Task<IActionResult> SetHousekeeping(Guid id, [FromBody] HousekeepingReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetRoomHousekeepingCommand(id, r.Status), ct));

    // ── Availability ─────────────────────────────────────────────────────────

    [RequirePermission("hospitality.bookings.view", "hospitality.bookings.create")]
    [HttpGet("availability")]
    public async Task<IActionResult> Availability(
        [FromQuery] string checkIn, [FromQuery] string checkOut, [FromQuery] int adults = 1, [FromQuery] int children = 0,
        [FromQuery] Guid? roomTypeId = null, [FromQuery] Guid? ratePlanId = null, [FromQuery] Guid? excludeBookingId = null,
        CancellationToken ct = default) =>
        OkOrError(await sender.Send(new SearchAvailabilityQuery(checkIn, checkOut, adults, children, roomTypeId, ratePlanId, excludeBookingId), ct));

    [RequirePermission("hospitality.bookings.view", "hospitality.rooms.view")]
    [HttpGet("tape-chart")]
    public async Task<IActionResult> TapeChart([FromQuery] string? from = null, [FromQuery] int days = 14, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetTapeChartQuery(from, days), ct));

    // ── Out-of-order blocks ──────────────────────────────────────────────────

    [RequirePermission("hospitality.rooms.view", "hospitality.bookings.view")]
    [HttpGet("blocks")]
    public async Task<IActionResult> GetBlocks([FromQuery] string? from = null, [FromQuery] string? to = null, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRoomBlocksQuery(from, to), ct));

    public sealed record BlockReq(Guid RoomId, string FromDate, string ToDate, string Reason);

    [RequirePermission("hospitality.rooms.edit")]
    [HttpPost("blocks")]
    public async Task<IActionResult> CreateBlock([FromBody] BlockReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new CreateRoomBlockCommand(r.RoomId, r.FromDate, r.ToDate, r.Reason), ct));

    [RequirePermission("hospitality.rooms.edit")]
    [HttpDelete("blocks/{id:guid}")]
    public async Task<IActionResult> DeleteBlock(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteRoomBlockCommand(id), ct));
}
