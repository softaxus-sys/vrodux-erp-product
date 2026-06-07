using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Queries.GetTransactionById;

public sealed class GetTransactionByIdQueryHandler(IPOSTransactionRepository txnRepo)
    : IQueryHandler<GetTransactionByIdQuery, POSTransactionDto>
{
    public async Task<Result<POSTransactionDto>> Handle(GetTransactionByIdQuery query, CancellationToken ct)
    {
        var txn = await txnRepo.GetByIdAsync(query.Id, ct);
        if (txn is null)
            return Result.Failure<POSTransactionDto>(Error.NotFoundById("Transaction", query.Id));

        return Result.Success(new POSTransactionDto(
            txn.Id, txn.TransactionNumber, txn.SessionId, txn.CashierId,
            txn.CustomerId, txn.Customer?.Name,
            txn.Type.ToString(), txn.Status.ToString(), txn.OriginalTxnId,
            txn.SubTotal, txn.TaxAmount, txn.DiscountAmount, txn.TotalAmount,
            txn.AmountPaid, txn.ChangeGiven, txn.Notes, txn.CompletedAt,
            txn.LineItems.Select(i => new POSLineItemDto(
                i.Id, i.ProductId, i.ProductName, i.ProductSKU, i.ProductBarcode,
                i.UnitPrice, i.Quantity, i.DiscountPercent, i.DiscountAmount,
                i.TaxRate, i.TaxAmount, i.LineTotal, i.Unit)).ToList(),
            txn.Payments.Select(p => new POSPaymentDto(
                p.Id, p.Method.ToString(), p.Amount, p.Reference)).ToList()));
    }
}
