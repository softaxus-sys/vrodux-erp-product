using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Common;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Commands.RefundTransaction;

public sealed class RefundTransactionCommandHandler(
    IPOSTransactionRepository  txnRepo,
    IPOSSessionRepository      sessionRepo,
    ICrossSchemaProductService productLookup,
    ICustomerRepository        customerRepo,
    ICustomerWalletTransactionRepository walletRepo,
    ICurrentUser               currentUser,
    IUnitOfWork                uow)
    : ICommandHandler<RefundTransactionCommand, POSTransactionDto>
{
    public async Task<Result<POSTransactionDto>> Handle(RefundTransactionCommand cmd, CancellationToken ct)
    {
        // A refund takes money out of the drawer, so it always needs the refund permission —
        // there is deliberately no "it was my own sale" fallback the way voiding has.
        // Enforced here as well as on the controller because the offline day-end sync replays
        // refunds through this handler via ISender, bypassing the controller entirely.
        if (!currentUser.HasPermission("pos.transactions.refund"))
            return Result.Failure<POSTransactionDto>(Error.Custom("Refund.Forbidden",
                "Insufficient permissions to refund transactions."));

        var originalTxn = await txnRepo.GetByIdAsync(cmd.OriginalTransactionId, ct);
        if (originalTxn is null)
            return Result.Failure<POSTransactionDto>(Error.NotFoundById("Transaction", cmd.OriginalTransactionId));

        if (originalTxn.Status != TransactionStatus.Completed)
            return Result.Failure<POSTransactionDto>(Error.Custom("Refund.OriginalNotCompleted",
                "Only completed transactions can be refunded."));

        var session = await sessionRepo.GetByIdAsync(cmd.SessionId, ct);
        if (session is null)
            return Result.Failure<POSTransactionDto>(Error.NotFoundById("Session", cmd.SessionId));

        if (session.Status != SessionStatus.Open)
            return Result.Failure<POSTransactionDto>(Error.Custom("Session.NotOpen",
                "Refunds can only be processed in an open session."));

        var txnNumber = await txnRepo.GenerateTransactionNumberAsync(ct);

        var refundTxnResult = POSTransaction.CreateRefund(
            txnNumber, cmd.SessionId,
            currentUser.Id ?? session.CashierId,
            cmd.OriginalTransactionId, originalTxn.CustomerId);

        if (refundTxnResult.IsFailure)
            return Result.Failure<POSTransactionDto>(refundTxnResult.Error);

        var refundTxn = refundTxnResult.Value;

        // Build refund line items (priced from the original transaction snapshot)
        var lineItems   = new List<POSLineItem>();
        var productViews = new Dictionary<Guid, ProductSaleView>();
        foreach (var req in cmd.LineItems)
        {
            var originalLine = originalTxn.LineItems.FirstOrDefault(l => l.ProductId == req.ProductId);
            if (originalLine is null)
                return Result.Failure<POSTransactionDto>(Error.Custom("Refund.ProductNotInOriginal",
                    $"Product {req.ProductId} was not in the original transaction."));

            if (req.Quantity > originalLine.Quantity)
                return Result.Failure<POSTransactionDto>(Error.Custom("Refund.ExceedsOriginal",
                    $"Refund quantity for '{originalLine.ProductName}' exceeds original quantity."));

            // Cross-schema lookup (pos.products OR inventory.products). For stock
            // restoration only — pricing uses the original transaction snapshot.
            var product = await productLookup.GetByIdForSaleAsync(req.ProductId, ct);

            var lineResult = POSLineItem.Create(
                refundTxn.Id,
                originalLine.ProductId, originalLine.ProductName, originalLine.ProductSKU, originalLine.ProductBarcode,
                originalLine.UnitPrice, originalLine.TaxRate, originalLine.Unit,
                req.Quantity, unitPriceOverride: originalLine.UnitPrice, discountPercent: 0, discountAmount: 0);

            if (lineResult.IsFailure)
                return Result.Failure<POSTransactionDto>(lineResult.Error);

            lineItems.Add(lineResult.Value);
            if (product is not null) productViews[req.ProductId] = product;
        }

        // Build payments
        var payments = new List<POSPayment>();
        foreach (var req in cmd.Payments)
        {
            var method = PaymentMethodCodeResolver.Resolve(req.Method);
            if (method is null)
                return Result.Failure<POSTransactionDto>(Error.Custom("Payment.InvalidMethod",
                    $"Invalid payment method '{req.Method}'."));

            var payResult = POSPayment.Create(refundTxn.Id, method.Value, req.Amount, req.Reference);
            if (payResult.IsFailure)
                return Result.Failure<POSTransactionDto>(payResult.Error);
            payments.Add(payResult.Value);
        }

        var completeResult = refundTxn.Complete(lineItems, payments, cmd.Reason);
        if (completeResult.IsFailure)
            return Result.Failure<POSTransactionDto>(completeResult.Error);

        // ── A refund of a sale bought on credit comes off what the customer owes ──
        // Otherwise the goods go back and the bill stays. The part of the refund that reverses credit is
        // what this sale put on the account, capped at what the customer still owes: if they have
        // already paid it, the money goes back the ordinary way instead.
        var creditOnSale = originalTxn.Payments.Where(p => p.Method == PaymentMethod.HouseAccount).Sum(p => p.Amount);
        var refundedToAccount = refundTxn.Payments.Where(p => p.Method == PaymentMethod.HouseAccount).Sum(p => p.Amount);
        if (creditOnSale > 0 || refundedToAccount > 0)
        {
            var owner = originalTxn.CustomerId is Guid cid ? await customerRepo.GetByIdAsync(cid, ct) : null;
            if (owner is null)
                return Result.Failure<POSTransactionDto>(Error.Custom("Credit.Conflict", "This refund has no customer account to credit."));

            var mustReverse = Math.Min(Math.Min(creditOnSale, refundTxn.TotalAmount), owner.CreditBalance);
            if (refundedToAccount + 0.01m < mustReverse)
                return Result.Failure<POSTransactionDto>(Error.Custom("Credit.Conflict",
                    $"This sale was bought on credit. Refund {mustReverse:N2} to the customer's account so it comes off what they owe."));
            if (refundedToAccount > mustReverse + 0.01m)
                return Result.Failure<POSTransactionDto>(Error.Custom("Credit.Conflict",
                    $"Only {mustReverse:N2} can go back to the customer's account; refund the rest another way."));

            if (refundedToAccount > 0)
            {
                owner.RecordHouseAccountPayment(refundedToAccount);
                customerRepo.Update(owner);
                walletRepo.Add(new CustomerWalletTransaction(owner.Id, "house_refund", refundedToAccount, originalTxn.Id,
                    $"Refund {txnNumber} of sale {originalTxn.TransactionNumber}"));
            }
        }

        // A refund paid out as store credit goes back onto the wallet.
        var toWallet = refundTxn.Payments.Where(p => p.Method == PaymentMethod.StoreCredit).Sum(p => p.Amount);
        if (toWallet > 0)
        {
            var holder = originalTxn.CustomerId is Guid wid ? await customerRepo.GetByIdAsync(wid, ct) : null;
            if (holder is null)
                return Result.Failure<POSTransactionDto>(Error.Custom("Wallet.Conflict", "Store-credit refunds need a customer account to put the credit on."));
            holder.TopUpWallet(toWallet);
            customerRepo.Update(holder);
            walletRepo.Add(new CustomerWalletTransaction(holder.Id, "wallet_refund", toWallet, originalTxn.Id,
                $"Refund {txnNumber} of sale {originalTxn.TransactionNumber}"));
        }

        if (cmd.Offline is not null)
            refundTxn.MarkOffline(cmd.Offline.ClientRef, cmd.Offline.ReceiptNumber, cmd.Offline.OccurredAtUtc);

        // Restore stock in the correct schema (pos or inventory)
        foreach (var req in cmd.LineItems)
        {
            if (productViews.TryGetValue(req.ProductId, out var pv))
                await productLookup.RestoreStockAsync(
                    pv, req.Quantity, txnNumber,
                    currentUser.Id ?? session.CashierId, refundTxn.Id, ct);
        }

        // Mark original transaction as refunded
        originalTxn.Void(currentUser.Id ?? Guid.Empty, $"Refunded via {txnNumber}");

        session.RecordTransaction(refundTxn.TotalAmount, isRefund: true);

        txnRepo.Add(refundTxn);
        txnRepo.Update(originalTxn);
        sessionRepo.Update(session);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new POSTransactionDto(
            refundTxn.Id, refundTxn.TransactionNumber, refundTxn.SessionId,
            refundTxn.CashierId, refundTxn.CustomerId, null,
            refundTxn.Type.ToString(), refundTxn.Status.ToString(),
            refundTxn.OriginalTxnId, refundTxn.SubTotal, refundTxn.TaxAmount,
            refundTxn.DiscountAmount, refundTxn.TotalAmount, refundTxn.AmountPaid,
            refundTxn.ChangeGiven, refundTxn.Notes, refundTxn.CompletedAt,
            refundTxn.LineItems.Select(i => new POSLineItemDto(
                i.Id, i.ProductId, i.ProductName, i.ProductSKU, i.ProductBarcode,
                i.UnitPrice, i.Quantity, i.DiscountPercent, i.DiscountAmount,
                i.TaxRate, i.TaxAmount, i.LineTotal, i.Unit)).ToList(),
            refundTxn.Payments.Select(p => new POSPaymentDto(
                p.Id, p.Method.ToString(), p.Amount, p.Reference)).ToList()));
    }
}
