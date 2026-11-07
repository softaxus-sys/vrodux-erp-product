using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Ecommerce.API.Authorization;
using Softaxis.Ecommerce.API.Controllers.Common;
using Softaxis.Ecommerce.Application.Channels;

namespace Softaxis.Ecommerce.API.Controllers;

/// <summary>Connected online stores. Access to them is its own permission group, apart from the listings and orders in them.</summary>
[Authorize]
[Route("api/ecommerce/channels")]
public sealed class ChannelsController(ISender sender) : EcommerceControllerBase
{
    /// <summary>The store kinds this build can connect (and which are not available yet).</summary>
    [HttpGet("providers")]
    [RequirePermission("ecommerce.channels.view")]
    public async Task<IActionResult> Providers(CancellationToken ct)
        => OkOrError(await sender.Send(new GetProvidersQuery(), ct));

    [HttpGet]
    [RequirePermission("ecommerce.channels.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => OkOrError(await sender.Send(new GetChannelsQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("ecommerce.channels.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new GetChannelByIdQuery(id), ct));

    /// <summary>The store's stock locations, to choose which one holds the stock.</summary>
    [HttpGet("{id:guid}/locations")]
    [RequirePermission("ecommerce.channels.view")]
    public async Task<IActionResult> Locations(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new GetChannelLocationsQuery(id), ct));

    [HttpPost("connect")]
    [RequirePermission("ecommerce.channels.create")]
    public async Task<IActionResult> Connect([FromBody] ConnectChannelCommand cmd, CancellationToken ct)
        => OkOrError(await sender.Send(cmd, ct));

    public sealed record UpdateChannelRequest(string Name, bool SyncStock, bool SyncContent, bool ImportOrders, string? LocationId, bool Paused);

    [HttpPut("{id:guid}")]
    [RequirePermission("ecommerce.channels.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateChannelRequest r, CancellationToken ct)
        => OkOrError(await sender.Send(new UpdateChannelCommand(id, r.Name, r.SyncStock, r.SyncContent, r.ImportOrders, r.LocationId, r.Paused), ct));

    public sealed record ReplaceTokenRequest(string AccessToken);

    [HttpPut("{id:guid}/token")]
    [RequirePermission("ecommerce.channels.edit")]
    public async Task<IActionResult> ReplaceToken(Guid id, [FromBody] ReplaceTokenRequest r, CancellationToken ct)
        => OkOrError(await sender.Send(new ReplaceChannelTokenCommand(id, r.AccessToken), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("ecommerce.channels.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => NoContentOrError(await sender.Send(new DeleteChannelCommand(id), ct));

    /// <summary>Syncs now: orders in, then content and stock out. <c>?resetStock=true</c> sets every stock level instead of sending changes.</summary>
    [HttpPost("{id:guid}/sync")]
    [RequirePermission("ecommerce.listings.edit")]
    public async Task<IActionResult> Sync(Guid id, [FromQuery] bool resetStock, CancellationToken ct)
        => OkOrError(await sender.Send(new SyncChannelCommand(id, resetStock), ct));

    [HttpPost("{id:guid}/orders/import")]
    [RequirePermission("ecommerce.orders.edit")]
    public async Task<IActionResult> ImportOrders(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new ImportChannelOrdersCommand(id), ct));
}

/// <summary>An Inventory listing as it exists in a store.</summary>
[Authorize]
[Route("api/ecommerce/listings")]
public sealed class ListingsController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    [RequirePermission("ecommerce.listings.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? channelId, [FromQuery] Guid? templateId, CancellationToken ct)
        => OkOrError(await sender.Send(new GetListingsQuery(channelId, templateId), ct));

    public sealed record PublishRequest(Guid ChannelId, Guid TemplateId);

    /// <summary>Sends an Inventory listing to a store (creating it there, with photos, variants and stock).</summary>
    [HttpPost]
    [RequirePermission("ecommerce.listings.create")]
    public async Task<IActionResult> Publish([FromBody] PublishRequest r, CancellationToken ct)
        => OkOrError(await sender.Send(new PublishListingCommand(r.ChannelId, r.TemplateId), ct));

    [HttpPost("{id:guid}/sync")]
    [RequirePermission("ecommerce.listings.edit")]
    public async Task<IActionResult> Sync(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new SyncListingCommand(id), ct));

    [HttpPost("{id:guid}/unpublish")]
    [RequirePermission("ecommerce.listings.edit")]
    public async Task<IActionResult> Unpublish(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new UnpublishListingCommand(id), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("ecommerce.listings.delete")]
    public async Task<IActionResult> Remove(Guid id, [FromQuery] bool deleteInStore, CancellationToken ct)
        => NoContentOrError(await sender.Send(new RemoveListingCommand(id, deleteInStore), ct));
}

/// <summary>Orders placed in the connected stores.</summary>
[Authorize]
[Route("api/ecommerce/orders")]
public sealed class ChannelOrdersController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    [RequirePermission("ecommerce.orders.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid? channelId, [FromQuery] string? search, [FromQuery] string? status,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default)
        => OkOrError(await sender.Send(new GetChannelOrdersQuery(channelId, search, status, page, pageSize), ct));
}

/// <summary>
/// Pickers for the Ecommerce screens. They read Inventory on the caller's behalf, so someone who manages the online
/// store does not also need Inventory permissions to choose a listing.
/// </summary>
[Authorize]
[Route("api/ecommerce/lookups")]
public sealed class LookupsController(ISender sender) : EcommerceControllerBase
{
    [HttpGet("templates")]
    [RequirePermission("ecommerce.listings.view")]
    public async Task<IActionResult> Templates([FromQuery] string? search, CancellationToken ct)
        => OkOrError(await sender.Send(new SearchTemplatesQuery(search), ct));
}
