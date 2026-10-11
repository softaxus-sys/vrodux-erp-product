namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// How and when a lease ended early, and the final account between landlord and tenant.
///
/// One row per lease. It is separate from the lease because it carries its own life: a notice is
/// recorded first ("scheduled"), the lease ends on the termination date ("pending_settlement"),
/// and the money is settled later ("settled").
/// </summary>
public sealed class LeaseTermination
{
    public const string Scheduled         = "scheduled";
    public const string PendingSettlement = "pending_settlement";
    public const string Settled           = "settled";

    public static readonly string[] Reasons =
        ["tenant_request", "non_payment", "breach", "mutual", "landlord_use", "property_sale", "other"];

    public Guid   Id         { get; private set; } = Guid.NewGuid();
    public Guid   ContractId { get; private set; }

    /// <summary>scheduled / pending_settlement / settled.</summary>
    public string Status     { get; private set; } = Scheduled;

    /// <summary>"yyyy-MM-dd" — the tenant's last day in the unit, inclusive.</summary>
    public string  TerminationDate { get; private set; } = null!;
    public string? NoticeDate      { get; private set; }
    public string  Reason          { get; private set; } = "other";
    public string? ReasonNotes     { get; private set; }

    // ── The final account, as at the termination date ────────────────────────
    public decimal RentOwed         { get; private set; }
    public decimal RentPaid         { get; private set; }
    public decimal DepositHeld      { get; private set; }
    public decimal PenaltyAmount    { get; private set; }
    public decimal DeductionsAmount { get; private set; }
    public string? DeductionNotes   { get; private set; }

    /// <summary>Positive = refund due to the tenant. Negative = the tenant still owes this much.</summary>
    public decimal NetSettlement    { get; private set; }

    public string? SettledOn           { get; private set; }
    public string? SettlementMethod    { get; private set; }
    public string? SettlementReference { get; private set; }
    public string? SettlementNotes     { get; private set; }

    public string?  RecordedByName { get; private set; }
    public DateTime CreatedAt      { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt      { get; private set; } = DateTime.UtcNow;

    private LeaseTermination() { }

    public LeaseTermination(Guid contractId, string terminationDate, string? noticeDate,
        string reason, string? reasonNotes, decimal penaltyAmount, decimal deductionsAmount,
        string? deductionNotes, string? recordedByName)
    {
        ContractId = contractId;
        TerminationDate = terminationDate;
        NoticeDate = string.IsNullOrWhiteSpace(noticeDate) ? null : noticeDate;
        Reason = Reasons.Contains(reason) ? reason : "other";
        ReasonNotes = string.IsNullOrWhiteSpace(reasonNotes) ? null : reasonNotes.Trim();
        PenaltyAmount = penaltyAmount;
        DeductionsAmount = deductionsAmount;
        DeductionNotes = string.IsNullOrWhiteSpace(deductionNotes) ? null : deductionNotes.Trim();
        RecordedByName = recordedByName;
    }

    /// <summary>Deposit + rent paid − rent owed − penalty − deductions.</summary>
    public static decimal Net(decimal depositHeld, decimal rentPaid, decimal rentOwed,
        decimal penalty, decimal deductions) =>
        depositHeld + rentPaid - rentOwed - penalty - deductions;

    public void SetFigures(decimal rentOwed, decimal rentPaid, decimal depositHeld)
    {
        RentOwed = rentOwed; RentPaid = rentPaid; DepositHeld = depositHeld;
        NetSettlement = Net(depositHeld, rentPaid, rentOwed, PenaltyAmount, DeductionsAmount);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The termination date has arrived and the lease has ended.</summary>
    public void TakeEffect()
    {
        // Nothing either way: there is no money to move, so there is nothing to wait for.
        Status = Math.Abs(NetSettlement) < 0.01m ? Settled : PendingSettlement;
        if (Status == Settled) SettledOn = TerminationDate;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Settle(string settledOn, string? method, string? reference, string? notes)
    {
        Status = Settled;
        SettledOn = settledOn;
        SettlementMethod = method;
        SettlementReference = reference;
        SettlementNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
