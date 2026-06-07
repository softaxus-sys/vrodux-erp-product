using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesOrders.Queries.GetSalesOrderById;

public sealed record GetSalesOrderByIdQuery(Guid Id) : IQuery<SalesOrderDto>;
