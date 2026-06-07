using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesQuotations.Commands.UpdateSalesQuotation;

public sealed class UpdateSalesQuotationCommandHandler(
    ISalesQuotationRepository sqRepo,
    IUnitOfWork               uow)
    : ICommandHandler<UpdateSalesQuotationCommand>
{
    public async Task<Result> Handle(UpdateSalesQuotationCommand cmd, CancellationToken ct)
    {
        var sq = await sqRepo.GetByIdAsync(cmd.Id, ct);
        if (sq is null) return Result.Failure(Error.NotFoundById("SalesQuotation", cmd.Id));

        sq.Update(cmd.CustomerId, cmd.CustomerName, cmd.Notes, cmd.ValidUntil, cmd.Status);

        sq.Items.Clear();
        foreach (var item in cmd.Items)
            sq.Items.Add(new SalesQuotationItem(
                sq.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
