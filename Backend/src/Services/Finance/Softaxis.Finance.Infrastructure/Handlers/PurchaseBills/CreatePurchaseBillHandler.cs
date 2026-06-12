using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Application.PurchaseBills.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class CreatePurchaseBillHandler(FinanceDbContext db) : ICommandHandler<CreatePurchaseBillCommand, PurchaseBillDto>
{
    public async Task<Result<PurchaseBillDto>> Handle(CreatePurchaseBillCommand cmd, CancellationToken ct)
    {
        var supplier = await db.Suppliers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.SupplierId, ct);
        if (supplier is null)
            return Result.Failure<PurchaseBillDto>(Error.Custom("PurchaseBill.SupplierNotFound", "The specified supplier does not exist."));

        var bill = new PurchaseBill(cmd.SupplierId, supplier.Name, cmd.BillDate, cmd.DueDate, cmd.TaxRate, cmd.Reference, cmd.Notes);

        foreach (var item in cmd.Items)
            bill.Items.Add(new PurchaseBillItem(bill.Id, item.Description, item.Quantity, item.UnitPrice));

        db.PurchaseBills.Add(bill);
        await db.SaveChangesAsync(ct);

        return Result.Success(PurchaseBillMappings.ToDto(bill));
    }
}
