using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Commands.VoidTransaction;

public sealed class VoidTransactionCommandHandler(
    IPOSTransactionRepository  txnRepo,
    ICrossSchemaProductService productLookup,
    ICurrentUser               currentUser,
    IUnitOfWork                uow)
    : ICommandHandler<VoidTransactionCommand, POSTransactionDto>
{
    public async Task<Result<POSTransactionDto>> Handle(VoidTransactionCommand cmd, CancellationToken ct)
    {
        var transaction = await txnRepo.GetByIdAsync(cmd.TransactionId, ct);
        if (transaction is null)
            return Result.Failure<POSTransactionDto>(Error.NotFoundById("Transaction", cmd.TransactionId));

        // Was "pos.transaction.void" — singular, and not a seeded key, so granting the real
        // permission (pos.transactions.void) did nothing and a supervisor could not void a
        // cashier's sale. A cashier may still void their own.
        if (!currentUser.HasPermission("pos.transactions.void") &&
            transaction.CashierId != currentUser.Id)
            return Result.Failure<POSTransactionDto>(Error.Custom("Txn.Forbidden", "Insufficient permissions to void transactions."));

        var voidResult = transaction.Void(currentUser.Id ?? Guid.Empty, cmd.Reason);
        if (voidResult.IsFailure)
            return Result.Failure<POSTransactionDto>(voidResult.Error);

        // Restore stock for voided transactions.
        // Must go through the cross-schema service, exactly as the sale deducted it: a POS sale can
        // be of a product living in EITHER pos.products or inventory.products. This previously used
        // the pos-schema repository only, so voiding a sale of an inventory-schema product silently
        // never put the stock back. Refund already did this correctly; void did not.
        foreach (var lineItem in transaction.LineItems)
        {
            var product = await productLookup.GetByIdForSaleAsync(lineItem.ProductId, ct);
            if (product is null || !product.TrackInventory) continue;

            await productLookup.RestoreStockAsync(
                product, lineItem.Quantity, $"VOID:{transaction.TransactionNumber}",
                currentUser.Id ?? Guid.Empty, transaction.Id, ct);
        }

        txnRepo.Update(transaction);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new POSTransactionDto(
            transaction.Id, transaction.TransactionNumber, transaction.SessionId,
            transaction.CashierId, transaction.CustomerId, null,
            transaction.Type.ToString(), transaction.Status.ToString(),
            transaction.OriginalTxnId, transaction.SubTotal, transaction.TaxAmount,
            transaction.DiscountAmount, transaction.TotalAmount, transaction.AmountPaid,
            transaction.ChangeGiven, transaction.Notes, transaction.CompletedAt,
            transaction.LineItems.Select(i => new POSLineItemDto(
                i.Id, i.ProductId, i.ProductName, i.ProductSKU, i.ProductBarcode,
                i.UnitPrice, i.Quantity, i.DiscountPercent, i.DiscountAmount,
                i.TaxRate, i.TaxAmount, i.LineTotal, i.Unit)).ToList(),
            transaction.Payments.Select(p => new POSPaymentDto(
                p.Id, p.Method.ToString(), p.Amount, p.Reference)).ToList()));
    }
}
