using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Represents a parked/held transaction that can be recalled later in the same session.
/// Line items are serialised as JSON since this is a transient hold — not a completed transaction.
/// </summary>
public sealed class HeldTransaction : Entity<Guid>
{
    public Guid     SessionId  { get; private set; }
    public Guid     CashierId  { get; private set; }
    public string   Label      { get; private set; } = default!;
    public string   ItemsJson  { get; private set; } = default!;  // serialised line items
    public Guid?    CustomerId { get; private set; }
    public DateTime HeldAt     { get; private set; }
    public bool     IsRecalled { get; private set; }

    // Navigation
    public POSSession Session { get; private set; } = default!;

    private HeldTransaction() { }

    public static Result<HeldTransaction> Create(
        Guid sessionId, Guid cashierId, string label,
        string itemsJson, Guid? customerId)
    {
        if (string.IsNullOrWhiteSpace(label))
            return Result.Failure<HeldTransaction>(Error.Custom("Hold.LabelRequired", "Hold label is required."));

        if (string.IsNullOrWhiteSpace(itemsJson))
            return Result.Failure<HeldTransaction>(Error.Custom("Hold.NoItems", "Cannot hold an empty transaction."));

        return Result.Success(new HeldTransaction
        {
            Id         = Guid.NewGuid(),
            SessionId  = sessionId,
            CashierId  = cashierId,
            Label      = label.Trim(),
            ItemsJson  = itemsJson,
            CustomerId = customerId,
            HeldAt     = DateTime.UtcNow
        });
    }

    public void Recall() => IsRecalled = true;
}
