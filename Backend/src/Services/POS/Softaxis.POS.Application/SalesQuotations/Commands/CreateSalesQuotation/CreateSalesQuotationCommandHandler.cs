using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesQuotations.Commands.CreateSalesQuotation;

public sealed class CreateSalesQuotationCommandHandler(
    ISalesQuotationRepository sqRepo,
    IUnitOfWork               uow)
    : ICommandHandler<CreateSalesQuotationCommand, SalesQuotationDto>
{
    public async Task<Result<SalesQuotationDto>> Handle(CreateSalesQuotationCommand cmd, CancellationToken ct)
    {
        var sq = new SalesQuotation(cmd.CustomerId, cmd.CustomerName, cmd.Notes, cmd.ValidUntil);

        foreach (var item in cmd.Items)
            sq.Items.Add(new SalesQuotationItem(
                sq.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        sqRepo.Add(sq);
        await uow.SaveChangesAsync(ct);

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
