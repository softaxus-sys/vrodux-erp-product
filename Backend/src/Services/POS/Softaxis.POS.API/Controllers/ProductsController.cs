using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.Products.Commands.AdjustStock;
using Softaxis.POS.Application.Products.Commands.CreateProduct;
using Softaxis.POS.Application.Products.Commands.DeleteProduct;
using Softaxis.POS.Application.Products.Commands.UpdateProduct;
using Softaxis.POS.Application.Products.Queries.GetProductByBarcode;
using Softaxis.POS.Application.Products.Queries.GetProductById;
using Softaxis.POS.Application.Products.Queries.GetProducts;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class ProductsController(ISender sender) : BaseApiController(sender)
{
    /// <summary>Get paginated product list.</summary>
    [HttpGet]
    public async Task<IActionResult> GetProducts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] bool? lowStock = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDesc = false,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetProductsQuery(page, pageSize, search, categoryId, isActive, lowStock, sortBy, sortDesc), ct));

    /// <summary>Get product by ID.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetProductByIdQuery(id), ct));

    /// <summary>Look up product by barcode (used at POS terminal).</summary>
    [HttpGet("barcode/{barcode}")]
    public async Task<IActionResult> GetByBarcode(string barcode, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetProductByBarcodeQuery(barcode), ct));

    /// <summary>Create a new product.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    /// <summary>Update an existing product.</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductCommand cmd, CancellationToken ct = default)
    {
        if (id != cmd.Id) return BadRequest("ID mismatch.");
        return HandleResult(await Sender.Send(cmd, ct));
    }

    /// <summary>Delete a product (soft delete).</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeleteProductCommand(id), ct));

    /// <summary>Manually adjust stock (purchase receipt, damage write-off, stock-take).</summary>
    [HttpPost("{id:guid}/stock-adjustment")]
    public async Task<IActionResult> AdjustStock(Guid id, [FromBody] AdjustStockRequest req, CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new AdjustStockCommand(id, req.Quantity, req.AdjustmentType, req.Reference, req.Notes), ct), successCode: 201);
}

public sealed record AdjustStockRequest(
    decimal Quantity,
    string  AdjustmentType,
    string? Reference,
    string? Notes);
