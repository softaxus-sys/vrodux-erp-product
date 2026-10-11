using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Manufacturing.Application.ProductionOrders.Dtos;

namespace Softaxis.Manufacturing.Application.ProductionOrders.Queries;

/// <param name="Reference">Exact reference match — how Sales finds the orders planned for one sales order.</param>
public sealed record GetProductionOrdersQuery(string? Status = null, string? Search = null, string? Reference = null)
    : IQuery<IReadOnlyList<ProductionOrderSummaryDto>>;

public sealed record GetProductionOrderByIdQuery(Guid Id) : IQuery<ProductionOrderDto>;

public sealed record GetProductionSummaryQuery : IQuery<ProductionSummaryDto>;
