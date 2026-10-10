using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Manufacturing.API.Authorization;
using Softaxis.Manufacturing.API.Controllers.Common;
using Softaxis.Manufacturing.Application.Lookups.Queries;

namespace Softaxis.Manufacturing.API.Controllers;

/// <summary>
/// Product and warehouse pickers for the BOM and production-order forms, read from Inventory.
/// Any Manufacturing permission is enough — no Inventory permission is needed.
/// </summary>
[Route("api/manufacturing/lookups")][Authorize]
[RequirePermission(
    "manufacturing.boms.view", "manufacturing.boms.create", "manufacturing.boms.edit",
    "manufacturing.orders.view", "manufacturing.orders.create", "manufacturing.orders.edit")]
public sealed class LookupsController(ISender sender) : ManufacturingControllerBase
{
    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] string? search, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetStockItemsQuery(search), ct));

    [HttpGet("warehouses")]
    public async Task<IActionResult> Warehouses(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetStockWarehousesQuery(), ct));
}
