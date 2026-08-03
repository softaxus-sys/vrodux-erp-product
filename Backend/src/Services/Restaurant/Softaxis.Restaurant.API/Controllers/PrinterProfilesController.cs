using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.PrinterProfiles.Commands;
using Softaxis.Restaurant.Application.PrinterProfiles.Queries;

namespace Softaxis.Restaurant.API.Controllers;

// No dedicated `restaurant.printers` permission group exists (and `restaurant.kitchen` has no
// `.create`/`.delete` keys) — printer/station config gates entirely on `restaurant.kitchen.*`
// (nearest-seeded-key convention).
[ApiController][Route("api/restaurant/printer-profiles")][Authorize]
public sealed class PrinterProfilesController(ISender sender) : RestaurantControllerBase
{
    [HttpGet]
    [RequirePermission("restaurant.kitchen.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPrinterProfilesQuery(), ct));

    [HttpPost]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> Create([FromBody] CreatePrinterProfileCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePrinterProfileReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdatePrinterProfileCommand(id, req.Name, req.Type, req.ConnectionType, req.IpAddress, req.Port, req.IsDefault), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.kitchen.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePrinterProfileCommand(id), ct));

    public record UpdatePrinterProfileReq(string Name, string Type, string ConnectionType, string? IpAddress, int? Port, bool IsDefault);
}
