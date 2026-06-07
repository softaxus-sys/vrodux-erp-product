using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Products.Commands.UpdateProduct;

public sealed record UpdateProductCommand(
    Guid     Id,
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
    string?  ImageUrl
) : ICommand;
