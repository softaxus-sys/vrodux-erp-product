using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesQuotations.Commands.ConvertQuotationToOrder;

public sealed record ConvertedOrderInfo(Guid SalesOrderId, string OrderNumber);

public sealed record ConvertQuotationToOrderCommand(Guid Id) : ICommand<ConvertedOrderInfo>;
