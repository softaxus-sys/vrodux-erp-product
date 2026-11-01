using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.API.Authorization;
using Softaxis.Inventory.Application.ProductPhotos;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Photos of a stock item. An online listing shows the photos of the items inside it.</summary>
[Authorize]
[Route("api/inventory/products/{productId:guid}/photos")]
[Tags("Product photos")]
public sealed class ProductPhotosController(ISender sender) : BaseApiController(sender)
{
    [HttpGet]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetAll(Guid productId, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetProductPhotosQuery(productId), ct));

    [HttpGet("{imageId:guid}")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> Get(Guid productId, Guid imageId, CancellationToken ct)
    {
        var result = await Sender.Send(new GetProductPhotoQuery(productId, imageId), ct);
        if (result.IsFailure) return HandleResult(result);
        Response.Headers.CacheControl = "private, max-age=86400";
        return File(result.Value.Data, result.Value.ContentType);
    }

    [HttpPost]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Add(Guid productId, [FromBody] AddImagesRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new AddProductPhotosCommand(productId, req.Images), ct), 201);

    [HttpPut("{imageId:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Update(Guid productId, Guid imageId, [FromBody] UpdateImageRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(new UpdateProductPhotoCommand(productId, imageId, req.AltText), ct));

    [HttpPatch("{imageId:guid}/primary")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> SetPrimary(Guid productId, Guid imageId, CancellationToken ct)
        => HandleResult(await Sender.Send(new SetPrimaryProductPhotoCommand(productId, imageId), ct));

    [HttpDelete("{imageId:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Delete(Guid productId, Guid imageId, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteProductPhotoCommand(productId, imageId), ct));
}
