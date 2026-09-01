using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.API.Authorization;
using Softaxis.Inventory.Application.Products.Commands.ActivateProduct;
using Softaxis.Inventory.Application.Products.Queries.GetInventoryDashboard;
using Softaxis.Inventory.Application.Products.Commands.CreateProduct;
using Softaxis.Inventory.Application.Products.Commands.DeactivateProduct;
using Softaxis.Inventory.Application.Products.Commands.DeleteProduct;
using Softaxis.Inventory.Application.Products.Commands.UpdateProduct;
using Softaxis.Inventory.Application.Products.Queries.GetProductByBarcode;
using Softaxis.Inventory.Application.Products.Queries.GetProductById;
using Softaxis.Inventory.Application.Products.Queries.GetProducts;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>Inventory product catalogue — CRUD + stock status toggles.</summary>
[Authorize]
[Tags("Products")]
public sealed class ProductsController(ISender sender) : BaseApiController(sender)
{
    // ── GET /api/inventory/products ──────────────────────────────────────────
    [HttpGet]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 20,
        [FromQuery] string? search     = null,
        [FromQuery] Guid?   categoryId = null,
        [FromQuery] bool?   isActive   = null,
        [FromQuery] bool?   isLowStock = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetProductsQuery(page, pageSize, search, categoryId, isActive, isLowStock), ct));

    // ── GET /api/inventory/products/dashboard ────────────────────────────────
    /// <summary>Per-category stock and valuation, aggregated in SQL for the dashboard charts.</summary>
    [HttpGet("dashboard")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetInventoryDashboardQuery(), ct));

    // ── GET /api/inventory/products/{id} ─────────────────────────────────────
    [HttpGet("{id:guid}")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetProductByIdQuery(id), ct));

    // ── GET /api/inventory/products/barcode/{barcode} ─────────────────────────
    [HttpGet("barcode/{barcode}")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> GetByBarcode(string barcode, CancellationToken ct)
        => HandleResult(await Sender.Send(new GetProductByBarcodeQuery(barcode), ct));

    // ── POST /api/inventory/products ─────────────────────────────────────────
    [HttpPost]
    [RequirePermission("inventory.stock.create")]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new CreateProductCommand(
                req.Name, req.Description, req.SKU, req.Barcode,
                req.CategoryId, req.BrandId, req.UnitOfMeasureId,
                req.SalePrice, req.CostPrice, req.TaxRate,
                req.Unit, req.OpeningStock, req.ReorderLevel, req.TrackInventory, req.ImageUrl), ct), 201);

    // ── PUT /api/inventory/products/{id} ─────────────────────────────────────
    [HttpPut("{id:guid}")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductRequest req, CancellationToken ct)
        => HandleResult(await Sender.Send(
            new UpdateProductCommand(
                id, req.Name, req.Description, req.SKU, req.Barcode,
                req.CategoryId, req.BrandId, req.UnitOfMeasureId,
                req.SalePrice, req.CostPrice, req.TaxRate,
                req.Unit, req.ReorderLevel, req.TrackInventory, req.ImageUrl), ct));

    // ── PATCH /api/inventory/products/{id}/activate ──────────────────────────
    [HttpPatch("{id:guid}/activate")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new ActivateProductCommand(id), ct));

    // ── PATCH /api/inventory/products/{id}/deactivate ────────────────────────
    [HttpPatch("{id:guid}/deactivate")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeactivateProductCommand(id), ct));

    // ── DELETE /api/inventory/products/{id} ──────────────────────────────────
    [HttpDelete("{id:guid}")]
    [RequirePermission("inventory.stock.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => HandleResult(await Sender.Send(new DeleteProductCommand(id), ct));
}

public sealed record CreateProductRequest(
    string   Name,
    string?  Description,
    string?  SKU,
    string?  Barcode,
    Guid     CategoryId,
    Guid?    BrandId,
    Guid?    UnitOfMeasureId,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    string   Unit,
    decimal  OpeningStock,
    decimal  ReorderLevel,
    bool     TrackInventory,
    string?  ImageUrl);

public sealed record UpdateProductRequest(
    string   Name,
    string?  Description,
    string?  SKU,
    string?  Barcode,
    Guid     CategoryId,
    Guid?    BrandId,
    Guid?    UnitOfMeasureId,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    string   Unit,
    decimal  ReorderLevel,
    bool     TrackInventory,
    string?  ImageUrl);
