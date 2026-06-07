using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.SalesOrders.Commands.DeleteSalesOrder;

public sealed record DeleteSalesOrderCommand(Guid Id) : ICommand;
