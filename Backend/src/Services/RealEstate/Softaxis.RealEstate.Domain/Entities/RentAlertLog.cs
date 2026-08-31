namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// The idempotency ledger for reminders. The sender runs daily and re-evaluates every open
/// installment each time, so without a record of what already went out a tenant would be mailed
/// the same "rent due in 7 days" notice every single day until it fell due.
///
/// The unique index on (tenant, contract, installment, kind, offset key) is what enforces that —
/// not the in-memory check, which cannot survive two workers or a restart mid-run.
/// </summary>
public sealed class RentAlertLog
{
    public Guid   Id            { get; private set; } = Guid.NewGuid();
    public Guid   ContractId    { get; private set; }

    /// <summary>Null for contract-expiry alerts, which are about the lease rather than a payment.</summary>
    public Guid?  InstallmentId { get; private set; }

    /// <summary>rent_due / rent_overdue / contract_expiry</summary>
    public string Kind          { get; private set; } = null!;

    /// <summary>Which rung of the ladder this was: "before:30", "overdue:3", "expiry:90".
    /// Part of the key, so each lead time sends exactly once.</summary>
    public string OffsetKey     { get; private set; } = null!;

    public string  ToEmail      { get; private set; } = null!;
    public string? CcEmails     { get; private set; }
    public bool    Sent         { get; private set; }
    public string? FailureReason{ get; private set; }
    public DateTime CreatedAt   { get; private set; } = DateTime.UtcNow;

    private RentAlertLog() { }

    public RentAlertLog(Guid contractId, Guid? installmentId, string kind, string offsetKey,
        string toEmail, string? ccEmails, bool sent, string? failureReason)
    {
        ContractId = contractId;
        InstallmentId = installmentId;
        Kind = kind;
        OffsetKey = offsetKey;
        ToEmail = toEmail;
        CcEmails = ccEmails;
        Sent = sent;
        FailureReason = failureReason;
    }

    /// <summary>Records the outcome after the send attempt. The row is written before the send
    /// (to claim the slot), so it starts life as not-sent and is settled here.</summary>
    public void MarkResult(bool sent, string? failureReason)
    {
        Sent = sent;
        FailureReason = failureReason;
    }

    public static string BeforeKey(int days)  => $"before:{days}";
    public static string OverdueKey(int step) => $"overdue:{step}";
    public static string ExpiryKey(int days)  => $"expiry:{days}";
}
