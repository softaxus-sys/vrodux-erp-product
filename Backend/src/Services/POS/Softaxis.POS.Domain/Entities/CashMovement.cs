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

    // Navigation
    public POSSession Session { get; private set; } = default!;

    private CashMovement() { }

    public static Result<CashMovement> Create(
        Guid sessionId, Guid cashierId, CashMovementType type, decimal amount, string reason)
    {
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
        });
    }
}
