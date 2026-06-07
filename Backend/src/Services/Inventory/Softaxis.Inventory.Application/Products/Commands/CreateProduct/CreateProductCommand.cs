using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Commands.CreateProduct;

public sealed record CreateProductCommand(
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
    string?  ImageUrl
) : ICommand<ProductDto>;
