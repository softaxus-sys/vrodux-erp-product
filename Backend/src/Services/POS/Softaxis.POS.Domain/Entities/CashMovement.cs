using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// A manual cash drawer movement during a shift — pay-in (cash added) or
/// pay-out (cash removed). Recorded against the session for accurate
/// end-of-shift reconciliation and the Z-report.
/// </summary>
public sealed class CashMovement : AuditableEntity<Guid>
{
    public Guid             SessionId { get; private set; }
    public Guid             CashierId { get; private set; }
    public CashMovementType Type      { get; private set; }
    public decimal          Amount    { get; private set; }
    public string           Reason    { get; private set; } = default!;

    /// <summary>What the movement was for — the other side of the accounting entry. Null on rows from before
    /// it was recorded, and on a movement replayed from an older offline queue.</summary>
    public string?          Category  { get; private set; }

    /// <summary>Category → the direction it is valid for.</summary>
    public static readonly IReadOnlyDictionary<string, CashMovementType> Categories = new Dictionary<string, CashMovementType>
    {
        ["owner_deposit"]    = CashMovementType.PayIn,
        ["bank_withdrawal"]  = CashMovementType.PayIn,
        ["bank_deposit"]     = CashMovementType.PayOut,
        ["petty_expense"]    = CashMovementType.PayOut,
        ["owner_withdrawal"] = CashMovementType.PayOut,
    };

    /// <summary>Client-generated id of a movement recorded offline (idempotency key for sync).</summary>
    public string?          ClientRef { get; private set; }

    public void MarkOffline(string clientRef, DateTime occurredAtUtc)
    {
        ClientRef = clientRef.Trim();
        CreatedAt = occurredAtUtc;
    }

    // Navigation
    public POSSession Session { get; private set; } = default!;

    private CashMovement() { }

    public static Result<CashMovement> Create(
        Guid sessionId, Guid cashierId, CashMovementType type, decimal amount, string reason, string? category = null)
    {
        category = string.IsNullOrWhiteSpace(category) ? null : category.Trim().ToLowerInvariant();
        if (category is not null && (!Categories.TryGetValue(category, out var allowed) || allowed != type))
            return Result.Failure<CashMovement>(Error.Custom("CashMovement.InvalidCategory",
                "That category does not fit cash going " + (type == CashMovementType.PayIn ? "in" : "out") + "."));

        if (amount <= 0)
            return Result.Failure<CashMovement>(Error.Custom("CashMovement.InvalidAmount",
                "Amount must be greater than zero."));

        if (string.IsNullOrWhiteSpace(reason))
            return Result.Failure<CashMovement>(Error.Custom("CashMovement.ReasonRequired",
                "A reason is required for cash in/out."));

        return Result.Success(new CashMovement
        {
            Id        = Guid.NewGuid(),
            SessionId = sessionId,
            CashierId = cashierId,
            Type      = type,
            Amount    = amount,
            Reason    = reason.Trim(),
            Category  = category,
        });
    }
}
