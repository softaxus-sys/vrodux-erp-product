using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Ecommerce.API.Authorization;
using Softaxis.Ecommerce.API.Controllers.Common;
using Softaxis.Ecommerce.Application.StoreAdmin;

namespace Softaxis.Ecommerce.API.Controllers;

/// <summary>The workspace's own online store: settings, pages, collections, shipping, discounts. Staff only.</summary>
[Authorize]
[Route("api/ecommerce/store")]
public sealed class StoreController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    [RequirePermission("ecommerce.store.view")]
    public async Task<IActionResult> Get(CancellationToken ct) => OkOrError(await sender.Send(new GetStoreQuery(), ct));

    public sealed record CreateRequest(string Name, string Slug);

    [HttpPost]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> Create([FromBody] CreateRequest r, CancellationToken ct) => OkOrError(await sender.Send(new CreateStoreCommand(r.Name, r.Slug), ct));

    [HttpPut]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> Update([FromBody] UpdateStoreCommand cmd, CancellationToken ct) => OkOrError(await sender.Send(cmd, ct));

    // ── Pages ──
    [HttpGet("pages")]
    [RequirePermission("ecommerce.store.view")]
    public async Task<IActionResult> Pages(CancellationToken ct) => OkOrError(await sender.Send(new GetPagesQuery(), ct));

    [HttpGet("pages/{id:guid}")]
    [RequirePermission("ecommerce.store.view")]
    public async Task<IActionResult> Page(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetPageQuery(id), ct));

    public sealed record PageRequest(string Slug, string Title, string Kind, bool IsPublished, string SectionsJson, string? SeoTitle, string? MetaDescription);

    [HttpPost("pages")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> CreatePage([FromBody] PageRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SavePageCommand(null, r.Slug, r.Title, r.Kind, r.IsPublished, r.SectionsJson, r.SeoTitle, r.MetaDescription), ct));

    [HttpPut("pages/{id:guid}")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> UpdatePage(Guid id, [FromBody] PageRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SavePageCommand(id, r.Slug, r.Title, r.Kind, r.IsPublished, r.SectionsJson, r.SeoTitle, r.MetaDescription), ct));

    [HttpDelete("pages/{id:guid}")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> DeletePage(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeletePageCommand(id), ct));

    // ── Images ──
    [HttpGet("assets")]
    [RequirePermission("ecommerce.store.view")]
    public async Task<IActionResult> Assets(CancellationToken ct) => OkOrError(await sender.Send(new GetAssetsQuery(), ct));

    /// <summary>Uploads a picture for the logo, a banner or a page. Raster images up to 3 MB.</summary>
    [HttpPost("assets")]
    [RequirePermission("ecommerce.store.edit")]
    [RequestSizeLimit(4 * 1024 * 1024)]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { Code = "Validation.Failed", Description = "Choose an image to upload." });
        if (file.Length > 3 * 1024 * 1024) return BadRequest(new { Code = "Validation.Failed", Description = "Images can be up to 3 MB." });
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        return OkOrError(await sender.Send(new UploadAssetCommand(file.FileName, file.ContentType, ms.ToArray()), ct));
    }

    // ── Collections ──
    [HttpGet("collections")]
    [RequirePermission("ecommerce.store.view")]
    public async Task<IActionResult> Collections(CancellationToken ct) => OkOrError(await sender.Send(new GetCollectionsQuery(), ct));

    public sealed record CollectionRequest(string Name, string Slug, string? Description, Guid? ImageAssetId, IReadOnlyList<Guid> TemplateIds, string? CategoryName, bool IsPublished, int SortOrder);

    [HttpPost("collections")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> CreateCollection([FromBody] CollectionRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveCollectionCommand(null, r.Name, r.Slug, r.Description, r.ImageAssetId, r.TemplateIds ?? [], r.CategoryName, r.IsPublished, r.SortOrder), ct));

    [HttpPut("collections/{id:guid}")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> UpdateCollection(Guid id, [FromBody] CollectionRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveCollectionCommand(id, r.Name, r.Slug, r.Description, r.ImageAssetId, r.TemplateIds ?? [], r.CategoryName, r.IsPublished, r.SortOrder), ct));

    [HttpDelete("collections/{id:guid}")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> DeleteCollection(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteCollectionCommand(id), ct));

    // ── Shipping ──
    [HttpGet("shipping")]
    [RequirePermission("ecommerce.store.view")]
    public async Task<IActionResult> Shipping(CancellationToken ct) => OkOrError(await sender.Send(new GetShippingZonesQuery(), ct));

    public sealed record ZoneRequest(string Name, IReadOnlyList<string> Countries, decimal FlatRate, decimal? FreeOver, decimal? MinOrder, string? EstimatedDays, bool IsActive, int SortOrder);

    [HttpPost("shipping")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> CreateZone([FromBody] ZoneRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveShippingZoneCommand(null, r.Name, r.Countries ?? [], r.FlatRate, r.FreeOver, r.MinOrder, r.EstimatedDays, r.IsActive, r.SortOrder), ct));

    [HttpPut("shipping/{id:guid}")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> UpdateZone(Guid id, [FromBody] ZoneRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveShippingZoneCommand(id, r.Name, r.Countries ?? [], r.FlatRate, r.FreeOver, r.MinOrder, r.EstimatedDays, r.IsActive, r.SortOrder), ct));

    [HttpDelete("shipping/{id:guid}")]
    [RequirePermission("ecommerce.store.edit")]
    public async Task<IActionResult> DeleteZone(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteShippingZoneCommand(id), ct));
}

[Authorize]
[Route("api/ecommerce/store/discounts")]
public sealed class StoreDiscountsController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    [RequirePermission("ecommerce.discounts.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct) => OkOrError(await sender.Send(new GetDiscountsQuery(), ct));

    public sealed record DiscountRequest(string Code, string Kind, decimal Value, decimal? MinSubtotal, int? MaxUses, DateTime? StartsAt, DateTime? EndsAt, bool IsActive);

    [HttpPost]
    [RequirePermission("ecommerce.discounts.create")]
    public async Task<IActionResult> Create([FromBody] DiscountRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveDiscountCommand(null, r.Code, r.Kind, r.Value, r.MinSubtotal, r.MaxUses, r.StartsAt, r.EndsAt, r.IsActive), ct));

    [HttpPut("{id:guid}")]
    [RequirePermission("ecommerce.discounts.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] DiscountRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new SaveDiscountCommand(id, r.Code, r.Kind, r.Value, r.MinSubtotal, r.MaxUses, r.StartsAt, r.EndsAt, r.IsActive), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("ecommerce.discounts.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => NoContentOrError(await sender.Send(new DeleteDiscountCommand(id), ct));
}

/// <summary>Orders placed in the workspace's own store (not the ones imported from Shopify).</summary>
[Authorize]
[Route("api/ecommerce/store/orders")]
public sealed class StoreOrdersController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    [RequirePermission("ecommerce.orders.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? status, [FromQuery] string? paymentStatus,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetStoreOrdersQuery(search, status, paymentStatus, page, pageSize), ct));

    [HttpGet("summary")]
    [RequirePermission("ecommerce.orders.view")]
    public async Task<IActionResult> Summary(CancellationToken ct) => OkOrError(await sender.Send(new GetStoreOrdersSummaryQuery(), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("ecommerce.orders.view")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new GetStoreOrderQuery(id), ct));

    public sealed record PaidRequest(string? Reference);
    [HttpPost("{id:guid}/paid")]
    [RequirePermission("ecommerce.orders.edit")]
    public async Task<IActionResult> Paid(Guid id, [FromBody] PaidRequest r, CancellationToken ct) => OkOrError(await sender.Send(new MarkStoreOrderPaidCommand(id, r?.Reference), ct));

    public sealed record ShipRequest(string? Carrier, string? TrackingNumber, string? TrackingUrl);
    [HttpPost("{id:guid}/ship")]
    [RequirePermission("ecommerce.orders.edit")]
    public async Task<IActionResult> Ship(Guid id, [FromBody] ShipRequest r, CancellationToken ct) => OkOrError(await sender.Send(new ShipStoreOrderCommand(id, r?.Carrier, r?.TrackingNumber, r?.TrackingUrl), ct));

    [HttpPost("{id:guid}/deliver")]
    [RequirePermission("ecommerce.orders.edit")]
    public async Task<IActionResult> Deliver(Guid id, CancellationToken ct) => OkOrError(await sender.Send(new DeliverStoreOrderCommand(id), ct));

    public sealed record ReasonRequest(string? Reason);
    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("ecommerce.orders.edit")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] ReasonRequest r, CancellationToken ct) => OkOrError(await sender.Send(new CancelStoreOrderCommand(id, r?.Reason), ct));

    [HttpPost("{id:guid}/refund")]
    [RequirePermission("ecommerce.orders.refund")]
    public async Task<IActionResult> Refund(Guid id, [FromBody] ReasonRequest r, CancellationToken ct) => OkOrError(await sender.Send(new RefundStoreOrderCommand(id, r?.Reason), ct));

    public sealed record NoteRequest(string? Note);
    [HttpPut("{id:guid}/note")]
    [RequirePermission("ecommerce.orders.edit")]
    public async Task<IActionResult> Note(Guid id, [FromBody] NoteRequest r, CancellationToken ct) => OkOrError(await sender.Send(new SetStoreOrderNoteCommand(id, r?.Note), ct));
}

[Authorize]
[Route("api/ecommerce/store/customers")]
public sealed class StoreCustomersController(ISender sender) : EcommerceControllerBase
{
    [HttpGet]
    [RequirePermission("ecommerce.customers.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetStoreCustomersQuery(search, page, pageSize), ct));
}
