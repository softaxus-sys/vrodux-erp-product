namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// A request from head office to a branch that runs on its own server: "void this order" or "refund this
/// order". Head office cannot change that branch's bills itself (the cloud refuses - see
/// <c>LocalBranchGuard</c>), so it asks, and the branch applies the change under its own rules.
///
/// <para>
/// Owned by the CLOUD: created at head office, flows DOWN to the branch. What the branch did about it is
/// a separate row (<see cref="BranchInstructionResult"/>, owned by the branch, flows UP), so neither side
/// ever edits a row the other owns. See <c>docs/branch-server-design.md</c> §7.
/// </para>
/// </summary>
public sealed class BranchInstruction
{
    public const string VoidOrder   = "void_order";
    public const string RefundOrder = "refund_order";

    private BranchInstruction() { }

    public BranchInstruction(Guid branchId, string kind, Guid orderId, string reason,
        decimal? amount, string? method, Guid requestedByUserId, string requestedByName)
    {
        Id = Guid.NewGuid();
        BranchId = branchId; Kind = kind; OrderId = orderId; Reason = reason.Trim();
        Amount = amount; Method = method;
        RequestedByUserId = requestedByUserId; RequestedByName = requestedByName;
        RequestedAt = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid BranchId { get; private set; }
    public string Kind { get; private set; } = string.Empty;
    public Guid OrderId { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public decimal? Amount { get; private set; }
    public string? Method { get; private set; }

    /// <summary>The head-office user who asked. The branch records the change under THIS id, so the audit trail names the person.</summary>
    public Guid RequestedByUserId { get; private set; }
    public string RequestedByName { get; private set; } = string.Empty;
    public DateTime RequestedAt { get; private set; }
}

/// <summary>
/// What the branch did with an instruction. One row per instruction (same id), written only by the branch.
/// <c>applying</c> is written BEFORE the change is attempted: if the server stops in between, the row stays
/// <c>applying</c> and a person looks, rather than a refund being run twice.
/// </summary>
public sealed class BranchInstructionResult
{
    public const string Applying  = "applying";
    public const string Applied   = "applied";
    public const string Rejected  = "rejected";

    private BranchInstructionResult() { }

    public BranchInstructionResult(Guid instructionId, Guid branchId)
    {
        Id = instructionId; BranchId = branchId; Status = Applying; UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Equal to the instruction's id.</summary>
    public Guid Id { get; private set; }
    public Guid BranchId { get; private set; }
    public string Status { get; private set; } = Applying;
    public string? Message { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public void Finish(bool success, string? message)
    {
        Status = success ? Applied : Rejected;
        Message = message is { Length: > 500 } ? message[..500] : message;
        UpdatedAt = DateTime.UtcNow;
    }
}
