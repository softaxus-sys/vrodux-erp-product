using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesQuotations.Commands.ConvertQuotationToOrder;

public sealed class ConvertQuotationToOrderCommandHandler(
    ISalesQuotationRepository sqRepo,
    ISalesOrderRepository     soRepo,
    IUnitOfWork               uow)
    : ICommandHandler<ConvertQuotationToOrderCommand, ConvertedOrderInfo>
{
    public async Task<Result<ConvertedOrderInfo>> Handle(ConvertQuotationToOrderCommand cmd, CancellationToken ct)
    {
        var sq = await sqRepo.GetByIdAsync(cmd.Id, ct);
        if (sq is null)
            return Result.Failure<ConvertedOrderInfo>(Error.NotFoundById("SalesQuotation", cmd.Id));

        if (sq.Status != "approved")
            return Result.Failure<ConvertedOrderInfo>(
                Error.Custom("SalesQuotation.NotApproved", "Only approved quotations can be converted."));

        var so = new SalesOrder(
            sq.CustomerId, sq.CustomerName,
            $"Converted from {sq.QuotationNumber}", null);

        foreach (var item in sq.Items)
            so.Items.Add(new SalesOrderItem(
                so.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        soRepo.Add(so);
        sq.Update(sq.CustomerId, sq.CustomerName, sq.Notes, sq.ValidUntil, "converted");

        await uow.SaveChangesAsync(ct);
        return Result.Success(new ConvertedOrderInfo(so.Id, so.OrderNumber));
    }
}
