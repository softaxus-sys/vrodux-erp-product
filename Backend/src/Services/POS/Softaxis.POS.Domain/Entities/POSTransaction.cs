using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Events;

namespace Softaxis.POS.Domain.Entities;

public sealed class POSTransaction : AuditableEntity<Guid>
{
    public string            TransactionNumber { get; private set; } = default!;
    public Guid              SessionId         { get; private set; }
    public Guid              CashierId         { get; private set; }
    public Guid?             CustomerId        { get; private set; }
    public TransactionType   Type              { get; private set; }
    public TransactionStatus Status            { get; private set; }
    public Guid?             OriginalTxnId     { get; private set; }  // For refunds/voids

    // Amounts
    public decimal SubTotal        { get; private set; }
    public decimal TaxAmount       { get; private set; }
    public decimal DiscountAmount  { get; private set; }
    public decimal TotalAmount     { get; private set; }
    public decimal AmountPaid      { get; private set; }
    public decimal ChangeGiven     { get; private set; }

    // Order-level discount metadata (for audit / receipt). The numeric discount
    // is captured in DiscountAmount; these record HOW it was applied.
    /// <summary>"none" | "percentage" | "fixed" | "voucher" | "loyalty"</summary>
    public string  OrderDiscountType      { get; private set; } = "none";
    /// <summary>Voucher code, or "POINTS:{n}" for loyalty, or null.</summary>
    public string? OrderDiscountReference { get; private set; }

    public string?   Notes         { get; private set; }
    public DateTime  CompletedAt   { get; private set; }

    // Navigation
    public POSSession              Session   { get; private set; } = default!;
    public Customer?               Customer  { get; private set; }
    public ICollection<POSLineItem>  LineItems { get; private set; } = [];
    public ICollection<POSPayment>   Payments  { get; private set; } = [];

    private POSTransaction() { }

    public static Result<POSTransaction> CreateSale(
        string transactionNumber,
        Guid sessionId,
        Guid cashierId,
        Guid? customerId)
    {
        if (string.IsNullOrWhiteSpace(transactionNumber))
            return Result.Failure<POSTransaction>(Error.Custom("Txn.NumberRequired", "Transaction number is required."));

        return Result.Success(new POSTransaction
        {
            Id                = Guid.NewGuid(),
            TransactionNumber = transactionNumber,
            SessionId         = sessionId,
            CashierId         = cashierId,
            CustomerId        = customerId,
            Type              = TransactionType.Sale,
            Status            = TransactionStatus.Pending,
            CompletedAt       = DateTime.UtcNow
        });
    }

    public Result Complete(IEnumerable<POSLineItem> lineItems, IEnumerable<POSPayment> payments, string? notes)
    {
        if (Status != TransactionStatus.Pending)
            return Result.Failure(Error.Custom("Txn.NotPending", "Only pending transactions can be completed."));

        var itemList    = lineItems.ToList();
        var paymentList = payments.ToList();

        if (!itemList.Any())
            return Result.Failure(Error.Custom("Txn.NoLineItems", "Transaction must have at least one line item."));

        if (!paymentList.Any())
            return Result.Failure(Error.Custom("Txn.NoPayments", "Transaction must have at least one payment."));

        SubTotal       = itemList.Sum(i => i.SubTotal);
        TaxAmount      = itemList.Sum(i => i.TaxAmount);
        DiscountAmount = itemList.Sum(i => i.DiscountAmount);
        TotalAmount    = itemList.Sum(i => i.LineTotal);
        AmountPaid     = paymentList.Sum(p => p.Amount);
        ChangeGiven    = Math.Max(0, AmountPaid - TotalAmount);
        Notes          = notes?.Trim();
        Status         = TransactionStatus.Completed;
        CompletedAt    = DateTime.UtcNow;

        foreach (var item in itemList) LineItems.Add(item);
        foreach (var pay  in paymentList) Payments.Add(pay);

        RaiseDomainEvent(new TransactionCompletedEvent(Id, SessionId, CashierId, CustomerId, TotalAmount, Type));

        return Result.Success();
    }

    public Result Void(Guid requestedBy, string? reason)
    {
        if (Status != TransactionStatus.Completed)
            return Result.Failure(Error.Custom("Txn.CannotVoid", "Only completed transactions can be voided."));

        if (Type == TransactionType.Refund)
            return Result.Failure(Error.Custom("Txn.CannotVoidRefund", "Refunds cannot be voided."));

        // Check if voided within same session day (business rule)
        Status = TransactionStatus.Voided;
        Notes  = reason?.Trim();

        RaiseDomainEvent(new TransactionVoidedEvent(Id, SessionId, requestedBy, TotalAmount));

        return Result.Success();
    }

    public static Result<POSTransaction> CreateRefund(
        string transactionNumber,
        Guid sessionId,
        Guid cashierId,
        Guid originalTxnId,
        Guid? customerId)
    {
        return Result.Success(new POSTransaction
        {
            Id                = Guid.NewGuid(),
            TransactionNumber = transactionNumber,
            SessionId         = sessionId,
            CashierId         = cashierId,
            CustomerId        = customerId,
            Type              = TransactionType.Refund,
            Status            = TransactionStatus.Pending,
            OriginalTxnId     = originalTxnId,
            CompletedAt       = DateTime.UtcNow
        });
    }

    /// <summary>Record how the order-level discount was applied (for audit and receipts).</summary>
    public void SetOrderDiscount(string type, string? reference)
    {
        OrderDiscountType      = string.IsNullOrWhiteSpace(type) ? "none" : type.Trim().ToLowerInvariant();
        OrderDiscountReference = reference?.Trim();
    }

    public bool IsCash => Payments.Any(p => p.Method == PaymentMethod.Cash);
}
