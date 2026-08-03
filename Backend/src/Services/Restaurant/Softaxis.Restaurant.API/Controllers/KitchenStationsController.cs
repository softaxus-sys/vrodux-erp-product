using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.KitchenStations.Commands;
using Softaxis.Restaurant.Application.KitchenStations.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/kitchen-stations")][Authorize]
public sealed class KitchenStationsController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.kitchen.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetKitchenStationsQuery(), ct));

    [HttpPost]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> Create([FromBody] CreateKitchenStationCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateKitchenStationReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateKitchenStationCommand(id, req.Name, req.DisplayName, req.ColorTag, req.SortOrder, req.PrinterProfileId), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteKitchenStationCommand(id), ct));

    public record UpdateKitchenStationReq(string Name, string? DisplayName, string? ColorTag, int SortOrder, Guid? PrinterProfileId);
}
