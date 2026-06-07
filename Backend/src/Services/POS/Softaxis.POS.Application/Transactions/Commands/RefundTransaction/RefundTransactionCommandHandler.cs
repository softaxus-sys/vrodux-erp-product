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
    ICurrentUser               currentUser,
    IUnitOfWork                uow)
    : ICommandHandler<RefundTransactionCommand, POSTransactionDto>
{
    public async Task<Result<POSTransactionDto>> Handle(RefundTransactionCommand cmd, CancellationToken ct)
    {
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
