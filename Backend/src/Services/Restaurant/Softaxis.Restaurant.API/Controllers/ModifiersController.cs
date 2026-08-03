using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.ModifierGroups.Commands;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Application.ModifierGroups.Queries;

namespace Softaxis.Restaurant.API.Controllers;

/// <summary>Manages modifier groups (e.g. "Size": Small/Medium/Large) — assignment to specific menu
/// items lives on MenuController since that's item-scoped.</summary>
[ApiController][Route("api/restaurant/modifier-groups")][Authorize]
public sealed class ModifiersController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/modifier-groups</summary>
    [HttpGet]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetModifierGroupsQuery(), ct));

    /// <summary>POST /api/restaurant/modifier-groups</summary>
    [HttpPost]
    [RequirePermission("restaurant.menu.create")]
    public async Task<IActionResult> Create([FromBody] CreateModifierGroupCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PUT /api/restaurant/modifier-groups/{id}</summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateModifierGroupReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateModifierGroupCommand(id, req.Name, req.MinSelect, req.MaxSelect, req.Modifiers), ct));

    /// <summary>DELETE /api/restaurant/modifier-groups/{id} — no dedicated delete key for
    /// restaurant.menu, gated on the nearest key (.edit), matching this repo's usual convention.</summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteModifierGroupCommand(id), ct));

    public record UpdateModifierGroupReq(string Name, int MinSelect, int MaxSelect, IReadOnlyList<ModifierInput> Modifiers);
}
