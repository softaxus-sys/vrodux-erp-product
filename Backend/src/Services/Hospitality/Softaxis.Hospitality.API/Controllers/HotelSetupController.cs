using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Hospitality.API.Authorization;
using Softaxis.Hospitality.API.Controllers.Common;
using Softaxis.Hospitality.Application.Guests;
using Softaxis.Hospitality.Application.Rooms.Commands;
using Softaxis.Hospitality.Application.Rooms.Queries;

namespace Softaxis.Hospitality.API.Controllers;

[ApiController][Route("api/hospitality/room-types")][Authorize]
public sealed class RoomTypesController(ISender sender) : HospitalityControllerBase
{
    // Read by every booking and room form, so open to anyone who books or manages rooms.
    [RequirePermission("hospitality.rooms.view", "hospitality.bookings.create", "hospitality.bookings.view", "hospitality.rates.view")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRoomTypesQuery(includeInactive), ct));

    public sealed record TypeReq(string Code, string Name, decimal BaseRate, int MaxAdults, int MaxChildren,
        string? Description, string? Amenities, bool IsActive = true);

    [RequirePermission("hospitality.rooms.create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TypeReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new UpsertRoomTypeCommand(null, r.Code, r.Name, r.BaseRate, r.MaxAdults,
            r.MaxChildren, r.Description, r.Amenities, r.IsActive), ct));

    [RequirePermission("hospitality.rooms.edit")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TypeReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertRoomTypeCommand(id, r.Code, r.Name, r.BaseRate, r.MaxAdults,
            r.MaxChildren, r.Description, r.Amenities, r.IsActive), ct));

    [RequirePermission("hospitality.rooms.delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteRoomTypeCommand(id), ct));
}

[ApiController][Route("api/hospitality/rate-plans")][Authorize]
public sealed class RatePlansController(ISender sender) : HospitalityControllerBase
{
    [RequirePermission("hospitality.rates.view", "hospitality.bookings.create")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRatePlansQuery(includeInactive), ct));

    public sealed record PlanReq(string Code, string Name, string MealPlan, bool IsRefundable, string? Description, bool IsActive = true);

    [RequirePermission("hospitality.rates.edit")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PlanReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new UpsertRatePlanCommand(null, r.Code, r.Name, r.MealPlan, r.IsRefundable, r.Description, r.IsActive), ct));

    [RequirePermission("hospitality.rates.edit")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] PlanReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertRatePlanCommand(id, r.Code, r.Name, r.MealPlan, r.IsRefundable, r.Description, r.IsActive), ct));

    [RequirePermission("hospitality.rates.edit")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteRatePlanCommand(id), ct));

    [RequirePermission("hospitality.rates.edit")]
    [HttpPost("{id:guid}/default")]
    public async Task<IActionResult> SetDefault(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetDefaultRatePlanCommand(id), ct));

    public sealed record SeasonReq(Guid RoomTypeId, string Label, string FromDate, string ToDate,
        decimal WeekdayRate, decimal? WeekendRate, int MinNights = 1);

    [RequirePermission("hospitality.rates.edit")]
    [HttpPost("{id:guid}/seasons")]
    public async Task<IActionResult> AddSeason(Guid id, [FromBody] SeasonReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new AddSeasonalRateCommand(id, r.RoomTypeId, r.Label, r.FromDate, r.ToDate,
            r.WeekdayRate, r.WeekendRate, r.MinNights), ct));

    [RequirePermission("hospitality.rates.edit")]
    [HttpDelete("{id:guid}/seasons/{seasonId:guid}")]
    public async Task<IActionResult> DeleteSeason(Guid id, Guid seasonId, CancellationToken ct) =>
        OkOrError(await sender.Send(new DeleteSeasonalRateCommand(id, seasonId), ct));
}

[ApiController][Route("api/hospitality/settings")][Authorize]
public sealed class HotelSettingsController(ISender sender) : HospitalityControllerBase
{
    // Booking screens show the tax and fee labels, so readers of bookings can read these.
    [RequirePermission("hospitality.settings.view", "hospitality.bookings.view", "hospitality.bookings.create")]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetHotelSettingsQuery(), ct));

    [RequirePermission("hospitality.settings.edit")]
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateHotelSettingsCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));
}

[ApiController][Route("api/hospitality/guests")][Authorize]
public sealed class GuestsController(ISender sender) : HospitalityControllerBase
{
    // The booking form looks guests up, so whoever can book can search.
    [RequirePermission("hospitality.guests.view", "hospitality.bookings.create")]
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetGuestsQuery(search, page, pageSize), ct));

    [RequirePermission("hospitality.guests.view")]
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetGuestByIdQuery(id), ct));

    public sealed record GuestReq(string FullName, string? Email, string? Phone, string? Nationality,
        string? DocumentType, string? DocumentNumber, string? DocumentExpiry, string? DateOfBirth,
        string? Address, string? Company, bool IsVip, string? Notes);

    [RequirePermission("hospitality.guests.create")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] GuestReq r, CancellationToken ct) =>
        CreatedOrError(await sender.Send(new UpsertGuestCommand(null, r.FullName, r.Email, r.Phone, r.Nationality,
            r.DocumentType, r.DocumentNumber, r.DocumentExpiry, r.DateOfBirth, r.Address, r.Company, r.IsVip, r.Notes), ct));

    [RequirePermission("hospitality.guests.edit")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] GuestReq r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpsertGuestCommand(id, r.FullName, r.Email, r.Phone, r.Nationality,
            r.DocumentType, r.DocumentNumber, r.DocumentExpiry, r.DateOfBirth, r.Address, r.Company, r.IsVip, r.Notes), ct));

    [RequirePermission("hospitality.guests.delete")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteGuestCommand(id), ct));
}
