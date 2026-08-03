using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Floors.Commands;
using Softaxis.Restaurant.Application.Floors.Queries;

namespace Softaxis.Restaurant.API.Controllers;

// Floors/DiningAreas are the floor-designer hierarchy above Table — no dedicated permission
// group exists for them, so they gate on the existing `restaurant.tables.*` keys (same
// nearest-seeded-key convention used elsewhere in this codebase for sub-resources).
[ApiController][Route("api/restaurant/floors")][Authorize]
public sealed class FloorsController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/floors — flat list, for dropdowns.</summary>
    [HttpGet]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFloorsQuery(), ct));

    /// <summary>GET /api/restaurant/floors/layout — full nested Floor→DiningArea→Table tree for the designer canvas.</summary>
    [HttpGet("layout")]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetLayout(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFloorLayoutQuery(), ct));

    /// <summary>POST /api/restaurant/floors</summary>
    [HttpPost]
    [RequirePermission("restaurant.tables.create")]
    public async Task<IActionResult> Create([FromBody] CreateFloorCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PUT /api/restaurant/floors/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateFloorReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateFloorCommand(id, req.Name, req.SortOrder), ct));

    /// <summary>DELETE /api/restaurant/floors/{id}</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteFloorCommand(id), ct));

    /// <summary>GET /api/restaurant/floors/{floorId}/dining-areas</summary>
    [HttpGet("{floorId:guid}/dining-areas")]
    [RequirePermission("restaurant.tables.view")]
    public async Task<IActionResult> GetDiningAreas(Guid floorId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDiningAreasQuery(floorId), ct));

    /// <summary>POST /api/restaurant/floors/{floorId}/dining-areas</summary>
    [HttpPost("{floorId:guid}/dining-areas")]
    [RequirePermission("restaurant.tables.create")]
    public async Task<IActionResult> CreateDiningArea(Guid floorId, [FromBody] DiningAreaReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateDiningAreaCommand(floorId, req.Name, req.Type, req.SortOrder), ct));

    /// <summary>PUT /api/restaurant/floors/{floorId}/dining-areas/{id}</summary>
    [HttpPut("{floorId:guid}/dining-areas/{id:guid}")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> UpdateDiningArea(Guid floorId, Guid id, [FromBody] DiningAreaReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateDiningAreaCommand(id, req.Name, req.Type, req.SortOrder), ct));

    /// <summary>DELETE /api/restaurant/floors/{floorId}/dining-areas/{id}</summary>
    [HttpDelete("{floorId:guid}/dining-areas/{id:guid}")]
    [RequirePermission("restaurant.tables.edit")]
    public async Task<IActionResult> DeleteDiningArea(Guid floorId, Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDiningAreaCommand(id), ct));

    public record UpdateFloorReq(string Name, int SortOrder);
    public record DiningAreaReq(string Name, string Type, int SortOrder);
}
