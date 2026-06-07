using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.SalesQuotations.Commands.CreateSalesQuotation;

public sealed record QuotationItemRequest(
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate);

public sealed record CreateSalesQuotationCommand(
    Guid?   CustomerId,
    string? CustomerName,
    string? Notes,
    string? ValidUntil,
    List<QuotationItemRequest> Items)
    : ICommand<SalesQuotationDto>;
