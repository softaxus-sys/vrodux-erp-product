using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.ProductStock.Dtos;

namespace Softaxis.Inventory.Application.ProductStock.Queries.GetProductBatches;

public sealed record GetProductBatchesQuery(Guid ProductId) : IQuery<IReadOnlyList<ProductBatchDto>>;
