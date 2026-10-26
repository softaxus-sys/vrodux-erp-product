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
    IPOSSessionRepository      sessionRepo,
    ICustomerRepository        customerRepo,
    ICustomerWalletTransactionRepository walletRepo,
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

        // A voided sale on credit takes its charge back off the account. If the customer has already
        // paid some of it, the sale cannot simply disappear: refund it instead, so the money goes back.
        var creditOnSale = transaction.Payments.Where(p => p.Method == PaymentMethod.HouseAccount).Sum(p => p.Amount);
        if (creditOnSale > 0 && transaction.CustomerId is Guid creditCustomerId)
        {
            var owner = await customerRepo.GetByIdAsync(creditCustomerId, ct);
            if (owner is not null)
            {
                if (creditOnSale > owner.CreditBalance + 0.01m)
                    return Result.Failure<POSTransactionDto>(Error.Custom("Credit.Conflict",
                        "This credit sale has already been paid in part. Refund it instead of voiding, so the money goes back to the customer."));
                owner.RecordHouseAccountPayment(creditOnSale);
                customerRepo.Update(owner);
                walletRepo.Add(new CustomerWalletTransaction(owner.Id, "house_refund", creditOnSale, transaction.Id,
                    $"Void of sale {transaction.TransactionNumber}"));
            }
        }

        var walletSpent = transaction.Payments.Where(p => p.Method == PaymentMethod.StoreCredit).Sum(p => p.Amount);
        if (walletSpent > 0 && transaction.CustomerId is Guid walletCustomerId)
        {
            var holder = await customerRepo.GetByIdAsync(walletCustomerId, ct);
            if (holder is not null)
            {
                holder.TopUpWallet(walletSpent);
                customerRepo.Update(holder);
                walletRepo.Add(new CustomerWalletTransaction(holder.Id, "wallet_refund", walletSpent, transaction.Id,
                    $"Void of sale {transaction.TransactionNumber}"));
            }
        }

        // Restore stock for voided transactions.
        // Must go through the cross-schema service, exactly as the sale deducted it: a POS sale can
        // be of a product living in EITHER pos.products or inventory.products. This previously used
        // the pos-schema repository only, so voiding a sale of an inventory-schema product silently
        // never put the stock back. Refund already did this correctly; void did not.
        // Stock goes back to the branch whose shift made the sale.
        var saleSession = await sessionRepo.GetByIdAsync(transaction.SessionId, ct);
        foreach (var lineItem in transaction.LineItems)
        {
            var product = await productLookup.GetByIdForSaleAsync(lineItem.ProductId, saleSession?.BranchId, ct);
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
