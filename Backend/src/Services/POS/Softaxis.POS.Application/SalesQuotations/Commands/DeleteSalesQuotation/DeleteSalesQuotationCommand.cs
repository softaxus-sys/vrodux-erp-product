using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.SalesQuotations.Commands.DeleteSalesQuotation;

public sealed record DeleteSalesQuotationCommand(Guid Id) : ICommand;
