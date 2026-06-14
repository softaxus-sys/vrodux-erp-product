using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.ProductStock.Queries.GetProductBatches;
using Softaxis.Inventory.Application.ProductStock.Queries.GetProductStockByProduct;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Per-warehouse on-hand stock for a product.</summary>
[ApiController]
[Route("api/inventory/product-stock")]
[Authorize]
public sealed class ProductStockController(ISender sender) : BaseApiController(sender)
{
    // GET /api/inventory/product-stock/{productId}
    [HttpGet("{productId:guid}")]
    public async Task<IActionResult> GetByProduct(Guid productId, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetProductStockByProductQuery(productId), ct));

    // GET /api/inventory/product-stock/{productId}/batches
    [HttpGet("{productId:guid}/batches")]
    public async Task<IActionResult> GetBatches(Guid productId, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetProductBatchesQuery(productId), ct));
}
