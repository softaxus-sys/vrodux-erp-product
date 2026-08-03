using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.DeliveryZones.Commands;
using Softaxis.Restaurant.Application.DeliveryZones.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/delivery-zones")][Authorize]
public sealed class DeliveryZonesController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.delivery.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDeliveryZonesQuery(), ct));

    [HttpPost]
    [RequirePermission("restaurant.delivery.create")]
    public async Task<IActionResult> Create([FromBody] CreateDeliveryZoneCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.delivery.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDeliveryZoneReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateDeliveryZoneCommand(id, req.Name, req.PostalCodesJson, req.DeliveryFee, req.MinOrderAmount, req.EstimatedMinutes, req.IsActive), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.delivery.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDeliveryZoneCommand(id), ct));

    public record UpdateDeliveryZoneReq(string Name, string? PostalCodesJson, decimal DeliveryFee, decimal MinOrderAmount, int EstimatedMinutes, bool IsActive);
}
