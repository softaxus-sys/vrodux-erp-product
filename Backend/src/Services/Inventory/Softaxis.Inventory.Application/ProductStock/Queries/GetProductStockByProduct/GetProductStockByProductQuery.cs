using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.ProductStock.Dtos;

namespace Softaxis.Inventory.Application.ProductStock.Queries.GetProductStockByProduct;

public sealed record GetProductStockByProductQuery(Guid ProductId) : IQuery<ProductStockSummaryDto>;
