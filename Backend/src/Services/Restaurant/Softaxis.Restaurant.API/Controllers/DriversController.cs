using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Drivers.Commands;
using Softaxis.Restaurant.Application.Drivers.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/drivers")][Authorize]
public sealed class DriversController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.delivery.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetDriversQuery(activeOnly), ct));

    [HttpPost]
    [RequirePermission("restaurant.delivery.create")]
    public async Task<IActionResult> Create([FromBody] CreateDriverCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.delivery.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDriverReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateDriverCommand(id, req.Name, req.Phone, req.VehicleInfo, req.IsActive), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.delivery.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteDriverCommand(id), ct));

    public record UpdateDriverReq(string Name, string Phone, string? VehicleInfo, bool IsActive);
}
