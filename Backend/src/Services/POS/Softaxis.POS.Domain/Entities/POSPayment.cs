using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Entities;

public sealed class POSPayment : Entity<Guid>
{
    public Guid          TransactionId { get; private set; }
    public PaymentMethod Method        { get; private set; }
    public decimal       Amount        { get; private set; }
    public string?       Reference     { get; private set; }  // card auth code, wallet txn id, etc.
    public DateTime      ProcessedAt   { get; private set; }

    // Navigation
    public POSTransaction Transaction { get; private set; } = default!;

    private POSPayment() { }

    public static Result<POSPayment> Create(
        Guid transactionId,
        PaymentMethod method,
        decimal amount,
        string? reference = null)
    {
        if (amount <= 0)
            return Result.Failure<POSPayment>(Error.Custom("Payment.InvalidAmount", "Payment amount must be greater than zero."));

        return Result.Success(new POSPayment
        {
            Id            = Guid.NewGuid(),
            TransactionId = transactionId,
            Method        = method,
            Amount        = Math.Round(amount, 2),
            Reference     = reference?.Trim(),
            ProcessedAt   = DateTime.UtcNow
        });
    }
}
