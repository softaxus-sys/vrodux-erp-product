using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Products.Queries.GetProductByBarcode;

public sealed record GetProductByBarcodeQuery(string Barcode) : IQuery<ProductSummaryDto>;
