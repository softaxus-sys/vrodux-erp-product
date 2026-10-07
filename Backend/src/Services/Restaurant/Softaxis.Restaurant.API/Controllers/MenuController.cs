using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Restaurant.API.Authorization;
using Softaxis.Restaurant.API.Controllers.Common;
using Softaxis.Restaurant.Application.Menu.Commands;
using Softaxis.Restaurant.Application.Menu.Queries;
using Softaxis.Restaurant.Application.ModifierGroups.Commands;
using Softaxis.Restaurant.Application.ModifierGroups.Queries;

namespace Softaxis.Restaurant.API.Controllers;

[ApiController][Route("api/restaurant/menu")][Authorize]
public sealed class MenuController(ISender sender) : RestaurantControllerBase
{
    /// <summary>GET /api/restaurant/menu/summary</summary>
    [HttpGet("summary")]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMenuSummaryQuery(), ct));

    /// <summary>GET /api/restaurant/menu</summary>
    [HttpGet]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMenuQuery(), ct));

    /// <summary>GET /api/restaurant/menu/items?categoryId=</summary>
    [HttpGet("items")]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetItems([FromQuery] Guid? categoryId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMenuItemsQuery(categoryId), ct));

    /// <summary>PATCH /api/restaurant/menu/items/{id}/availability</summary>
    [HttpPatch("items/{id:guid}/availability")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> SetAvailability(Guid id, [FromBody] SetAvailabilityReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetItemAvailabilityCommand(id, req.IsAvailable), ct));

    /// <summary>POST /api/restaurant/menu/categories</summary>
    [HttpPost("categories")]
    [RequirePermission("restaurant.menu.create")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateMenuCategoryCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>POST /api/restaurant/menu/items</summary>
    [HttpPost("items")]
    [RequirePermission("restaurant.menu.create")]
    public async Task<IActionResult> CreateItem([FromBody] CreateMenuItemCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>POST /api/restaurant/menu/import — bulk categories + dishes from a spreadsheet.</summary>
    [HttpPost("import")]
    [RequirePermission("restaurant.menu.create")]
    public async Task<IActionResult> Import([FromBody] ImportMenuCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    /// <summary>PUT /api/restaurant/menu/items/{id}</summary>
    [HttpPut("items/{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpdateItemReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateMenuItemCommand(
            id, req.Name, req.Description, req.Price, req.PrepTimeMinutes, req.Allergens, req.IsOnlineOrderable), ct));

    /// <summary>DELETE /api/restaurant/menu/items/{id} — no dedicated delete key for restaurant.menu,
    /// gated on the nearest key (.edit), matching this repo's usual convention.</summary>
    [HttpDelete("items/{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> DeleteItem(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteMenuItemCommand(id), ct));

    /// <summary>PUT /api/restaurant/menu/categories/{id}</summary>
    [HttpPut("categories/{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] UpdateCategoryReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateMenuCategoryCommand(id, req.Name, req.Description, req.SortOrder), ct));

    /// <summary>DELETE /api/restaurant/menu/categories/{id} — 409 while the category still has items.</summary>
    [HttpDelete("categories/{id:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteMenuCategoryCommand(id), ct));

    /// <summary>PATCH /api/restaurant/menu/items/{id}/kitchen-station</summary>
    [HttpPatch("items/{id:guid}/kitchen-station")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> SetItemStation(Guid id, [FromBody] SetStationReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetMenuItemKitchenStationCommand(id, req.KitchenStationId), ct));

    /// <summary>PATCH /api/restaurant/menu/categories/{id}/kitchen-station</summary>
    [HttpPatch("categories/{id:guid}/kitchen-station")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> SetCategoryStation(Guid id, [FromBody] SetStationReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new SetMenuCategoryKitchenStationCommand(id, req.KitchenStationId), ct));

    /// <summary>GET /api/restaurant/menu/items/{id}/modifier-groups — assigned group ids.</summary>
    [HttpGet("items/{id:guid}/modifier-groups")]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetItemModifierGroups(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetMenuItemModifierGroupsQuery(id), ct));

    /// <summary>PUT /api/restaurant/menu/items/{id}/modifier-groups — replaces the assigned set.</summary>
    [HttpPut("items/{id:guid}/modifier-groups")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> AssignItemModifierGroups(Guid id, [FromBody] AssignModifierGroupsReq req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new AssignMenuItemModifierGroupsCommand(id, req.ModifierGroupIds), ct));

    // ── Dish photos ──────────────────────────────────────────────────────────────

    /// <summary>GET /api/restaurant/menu/items/{id}/images/{imageId} — one photo's bytes. A dedicated
    /// endpoint rather than base64 in the menu JSON, so every till caches each photo once.</summary>
    [HttpGet("items/{id:guid}/images/{imageId:guid}")]
    [RequirePermission("restaurant.menu.view")]
    public async Task<IActionResult> GetItemImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var result = await sender.Send(new GetMenuItemImageQuery(id, imageId), ct);
        if (!result.IsSuccess) return OkOrError(result);
        // A photo's bytes never change — replacing one means uploading a new id — so cache hard.
        Response.Headers.CacheControl = "private, max-age=31536000, immutable";
        return File(result.Value.Data, result.Value.ContentType);
    }

    /// <summary>POST /api/restaurant/menu/items/{id}/images — upload one or more photos.</summary>
    [HttpPost("items/{id:guid}/images")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> AddItemImages(Guid id, [FromBody] AddItemImagesReq req, CancellationToken ct) =>
        OkOrError(await sender.Send(new AddMenuItemImagesCommand(id, req.Images), ct));

    [HttpDelete("items/{id:guid}/images/{imageId:guid}")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> DeleteItemImage(Guid id, Guid imageId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteMenuItemImageCommand(id, imageId), ct));

    /// <summary>PATCH .../images/{imageId}/primary — make this the cover photo.</summary>
    [HttpPatch("items/{id:guid}/images/{imageId:guid}/primary")]
    [RequirePermission("restaurant.menu.edit")]
    public async Task<IActionResult> SetPrimaryItemImage(Guid id, Guid imageId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new SetPrimaryMenuItemImageCommand(id, imageId), ct));

    public record AddItemImagesReq(IReadOnlyList<MenuItemImageInput> Images);
    public record SetAvailabilityReq(bool IsAvailable);
    public record AssignModifierGroupsReq(IReadOnlyList<Guid> ModifierGroupIds);
    public record SetStationReq(Guid? KitchenStationId);
    public record UpdateItemReq(string Name, string? Description, decimal Price, int PrepTimeMinutes, string? Allergens, bool IsOnlineOrderable);
    public record UpdateCategoryReq(string Name, string? Description, int SortOrder);
}
