using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Commands.VoidTransaction;

public sealed class VoidTransactionCommandHandler(
    IPOSTransactionRepository txnRepo,
    IProductRepository        productRepo,
    IStockMovementRepository  stockRepo,
    ICurrentUser              currentUser,
    IUnitOfWork               uow)
    : ICommandHandler<VoidTransactionCommand, POSTransactionDto>
{
    public async Task<Result<POSTransactionDto>> Handle(VoidTransactionCommand cmd, CancellationToken ct)
    {
        var transaction = await txnRepo.GetByIdAsync(cmd.TransactionId, ct);
        if (transaction is null)
            return Result.Failure<POSTransactionDto>(Error.NotFoundById("Transaction", cmd.TransactionId));

        if (!currentUser.HasPermission("pos.transaction.void") &&
            transaction.CashierId != currentUser.Id)
            return Result.Failure<POSTransactionDto>(Error.Custom("Txn.Forbidden", "Insufficient permissions to void transactions."));

        var voidResult = transaction.Void(currentUser.Id ?? Guid.Empty, cmd.Reason);
        if (voidResult.IsFailure)
            return Result.Failure<POSTransactionDto>(voidResult.Error);

        // Restore stock for voided transactions
        foreach (var lineItem in transaction.LineItems)
        {
            var product = await productRepo.GetByIdAsync(lineItem.ProductId, ct);
            if (product is null || !product.TrackInventory) continue;

            product.AdjustStock(lineItem.Quantity, StockAdjustmentType.Return, $"VOID:{transaction.TransactionNumber}");
            var movement = StockMovement.Create(
                product.Id, StockAdjustmentType.Return, lineItem.Quantity,
                product.StockQuantity, currentUser.Id ?? Guid.Empty,
                $"VOID:{transaction.TransactionNumber}", transaction.Id);
            stockRepo.Add(movement);
            productRepo.Update(product);
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
