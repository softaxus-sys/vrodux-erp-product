using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Products.Queries.GetProductByBarcode;

public sealed record GetProductByBarcodeQuery(string Barcode) : IQuery<ProductDto>;
