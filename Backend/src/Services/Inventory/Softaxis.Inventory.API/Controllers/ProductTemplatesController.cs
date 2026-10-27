using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.API.Authorization;
using Softaxis.Inventory.Application.ProductTemplates;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>
/// Online listings: one name, one description, one photo gallery and a set of choices (Size, Colour…),
/// each combination being an ordinary Inventory product. Gated on the stock permissions for now — a
/// listing is Inventory data — and will get its own keys when the E-commerce module has screens.
/// </summary>
[Authorize]
[Route("api/inventory/product-templates")]
[Tags("Product listings")]
public sealed class ProductTemplatesController(ISender sender) : BaseApiController(sender)
{
    [HttpGet]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null, [FromQuery] bool? published = null, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetProductTemplatesQuery(page, pageSize, search, categoryId, published), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetProductTemplateByIdQuery(id), ct));

    [HttpGet("{id:guid}/publish-check")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> PublishCheck(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetPublishCheckQuery(id), ct));

    [HttpPost]
    [RequirePermission("inventory.stock.create")]
    public async Task<IActionResult> Create([FromBody] CreateProductTemplateCommand cmd, CancellationToken ct)
        => HandleResult(await Sender.Send(cmd, ct), 201);

    [HttpPut("{id:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTemplateRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateProductTemplateCommand(id, req.Content, req.Options, req.VariantChoices), ct));

    [HttpPatch("{id:guid}/published")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> SetPublished(Guid id, [FromBody] PublishRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetTemplatePublishedCommand(id, req.Published), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("inventory.stock.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteProductTemplateCommand(id), ct));

    // ── Variants ─────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/variants")]
    [RequirePermission("inventory.stock.create")]
    public async Task<IActionResult> AddVariants(Guid id, [FromBody] AddVariantsRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new AddTemplateVariantsCommand(id, req.Variants), ct));

    [HttpPut("{id:guid}/variants/{productId:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> UpdateVariant(Guid id, Guid productId, [FromBody] UpdateVariantRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateTemplateVariantCommand(
            id, productId, req.Options, req.SellOnline, req.WeightGrams, req.LengthCm, req.WidthCm, req.HeightCm), ct));

    [HttpDelete("{id:guid}/variants/{productId:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> RemoveVariant(Guid id, Guid productId, CancellationToken ct)
        => HandleResult(await Sender.Send(new RemoveTemplateVariantCommand(id, productId), ct));

    // ── Photos ───────────────────────────────────────────────────────────────

    [HttpPost("{id:guid}/images")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> AddImages(Guid id, [FromBody] AddImagesRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new AddTemplateImagesCommand(id, req.Images), ct), 201);

    [HttpGet("{id:guid}/images/{imageId:guid}")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetImage(Guid id, Guid imageId, CancellationToken ct)
    {
        var result = await Sender.Send(new GetTemplateImageQuery(id, imageId), ct);
        if (result.IsFailure) return HandleResult(result);
        Response.Headers.CacheControl = "private, max-age=86400";
        return File(result.Value.Data, result.Value.ContentType);
    }

    [HttpPut("{id:guid}/images/{imageId:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> UpdateImage(Guid id, Guid imageId, [FromBody] UpdateImageRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateTemplateImageCommand(id, imageId, req.AltText, req.ProductId), ct));

    [HttpPatch("{id:guid}/images/{imageId:guid}/primary")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> SetPrimary(Guid id, Guid imageId, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetPrimaryTemplateImageCommand(id, imageId), ct));

    [HttpPut("{id:guid}/images/order")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Reorder(Guid id, [FromBody] ReorderRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new ReorderTemplateImagesCommand(id, req.OrderedIds), ct));

    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteTemplateImageCommand(id, imageId), ct));
}

public sealed record UpdateTemplateRequest(
    ProductTemplateContent Content, IReadOnlyList<ProductOptionInput> Options,
    IReadOnlyList<VariantChoiceInput>? VariantChoices = null);
public sealed record PublishRequest(bool Published);
public sealed record AddVariantsRequest(IReadOnlyList<VariantInput> Variants);
public sealed record UpdateVariantRequest(
    IReadOnlyDictionary<string, string> Options, bool SellOnline,
    decimal? WeightGrams, decimal? LengthCm, decimal? WidthCm, decimal? HeightCm);
public sealed record AddImagesRequest(IReadOnlyList<ProductImageInput> Images);
public sealed record UpdateImageRequest(string? AltText, Guid? ProductId);
public sealed record ReorderRequest(IReadOnlyList<Guid> OrderedIds);
