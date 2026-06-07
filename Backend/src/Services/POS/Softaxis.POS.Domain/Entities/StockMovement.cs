using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Immutable audit trail of every stock change for a product.
/// </summary>
public sealed class StockMovement : Entity<Guid>
{
    public Guid                ProductId      { get; private set; }
    public StockAdjustmentType AdjustmentType { get; private set; }
    public decimal             Quantity       { get; private set; }   // positive = in, negative = out
    public decimal             BalanceAfter   { get; private set; }
    public string?             Reference      { get; private set; }   // PO number, txn number, etc.
    public Guid?               TransactionId  { get; private set; }
    public Guid                CreatedBy      { get; private set; }
    public DateTime            CreatedAt      { get; private set; }
    public string?             Notes          { get; private set; }

    // Navigation
    public Product Product { get; private set; } = default!;

    private StockMovement() { }

    public static StockMovement Create(
        Guid productId,
        StockAdjustmentType type,
        decimal quantity,
        decimal balanceAfter,
        Guid createdBy,
        string? reference = null,
        Guid? transactionId = null,
        string? notes = null)
        => new()
        {
            Id             = Guid.NewGuid(),
            ProductId      = productId,
            AdjustmentType = type,
            Quantity       = quantity,
            BalanceAfter   = balanceAfter,
            CreatedBy      = createdBy,
            Reference      = reference?.Trim(),
            TransactionId  = transactionId,
            Notes          = notes?.Trim(),
            CreatedAt      = DateTime.UtcNow
        };
}
