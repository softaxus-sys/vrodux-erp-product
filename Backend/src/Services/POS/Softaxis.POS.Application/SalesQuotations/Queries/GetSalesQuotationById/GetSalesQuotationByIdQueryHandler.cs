using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesQuotations.Queries.GetSalesQuotationById;

public sealed class GetSalesQuotationByIdQueryHandler(ISalesQuotationRepository sqRepo)
    : IQueryHandler<GetSalesQuotationByIdQuery, SalesQuotationDto>
{
    public async Task<Result<SalesQuotationDto>> Handle(GetSalesQuotationByIdQuery query, CancellationToken ct)
    {
        var sq = await sqRepo.GetByIdAsync(query.Id, ct);
        if (sq is null) return Result.Failure<SalesQuotationDto>(Error.NotFoundById("SalesQuotation", query.Id));

        return Result.Success(new SalesQuotationDto(
            sq.Id, sq.QuotationNumber, sq.CustomerId, sq.CustomerName,
            sq.Status, sq.Notes, sq.ValidUntil,
            sq.SubTotal, sq.TaxAmount, sq.Total,
            sq.Items.Select(i => new SalesQuotationItemDto(
                i.Id, i.ProductId, i.Description, i.Quantity,
                i.UnitPrice, i.DiscountPercent, i.TaxRate, i.LineTotal)).ToList(),
            sq.CreatedAt, sq.UpdatedAt));
    }
}
