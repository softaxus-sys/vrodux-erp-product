using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.SalesQuotations.Commands.CreateSalesQuotation;

namespace Softaxis.POS.Application.SalesQuotations.Commands.UpdateSalesQuotation;

public sealed record UpdateSalesQuotationCommand(
    Guid    Id,
    Guid?   CustomerId,
    string? CustomerName,
    string  Status,
    string? Notes,
    string? ValidUntil,
    List<QuotationItemRequest> Items)
    : ICommand;
