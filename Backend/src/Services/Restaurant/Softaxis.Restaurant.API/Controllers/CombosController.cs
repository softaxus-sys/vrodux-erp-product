using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Combos.Commands;
using Softaxis.Restaurant.Application.Combos.Queries;

namespace Softaxis.Restaurant.API.Controllers;

// No dedicated `restaurant.combos` permission group — combos are a menu/pricing concept, so they
// gate on `restaurant.menu.*` (nearest-seeded-key convention).
[ApiController][Route("api/restaurant/combos")][Authorize]
public sealed class CombosController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/combos?activeOnly=</summary>
    [HttpGet]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCombosQuery(activeOnly), ct));

    [HttpPost]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Create([FromBody] CreateComboCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateComboReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateComboCommand(id, req.Name, req.Price, req.IsActive, req.Items), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteComboCommand(id), ct));

    public record UpdateComboReq(string Name, decimal Price, bool IsActive, IReadOnlyList<ComboItemInput> Items);
}
