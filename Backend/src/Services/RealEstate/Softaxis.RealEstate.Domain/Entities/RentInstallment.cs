namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// One scheduled rent payment on a lease. The lease previously carried a single running
/// <c>TotalPaid</c>, which cannot say when money is DUE — so nothing could be reminded about,
/// and nothing could be late. This is the row a reminder is sent against.
/// </summary>
public sealed class RentInstallment
{
    public Guid   Id                { get; private set; } = Guid.NewGuid();
    public Guid   ContractId        { get; private set; }
    public int    InstallmentNumber { get; private set; }

    /// <summary>"yyyy-MM-dd". String to match StartDate/EndDate on the lease — ISO dates
    /// compare correctly lexicographically, so date filtering still works in SQL.</summary>
    public string DueDate           { get; private set; } = null!;

    public decimal Amount           { get; private set; }
    public decimal AmountPaid       { get; private set; }

    /// <summary>pending / paid / partial / waived / cancelled. NOTE there is deliberately no "overdue"
    /// value: lateness is a function of today's date, so a stored flag would be wrong from the
    /// moment the clock passed it until something re-ran. Use <see cref="IsOverdue"/>.</summary>
    public string  Status           { get; private set; } = "pending";

    public string? PaidDate         { get; private set; }
    public string? PaymentMethod    { get; private set; }
    public string? Reference        { get; private set; }
    public string? Notes            { get; private set; }

    public bool     IsDeleted       { get; private set; }
    public DateTime CreatedAt       { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt       { get; private set; } = DateTime.UtcNow;

    // ── computed — not mapped ────────────────────────────────────────────────
    public decimal Balance => Amount - AmountPaid;
    // "cancelled" = the lease ended before this payment fell due, so it is not owed. Kept as a row
    // rather than deleted so the schedule still shows what the lease was signed for.
    public bool    IsSettled => Status is "paid" or "waived" or "cancelled";

    public bool IsOverdue(string today) => !IsSettled && string.CompareOrdinal(DueDate, today) < 0;

    public int DaysOverdue(string today) =>
        IsOverdue(today) && DateTime.TryParse(DueDate, out var d) && DateTime.TryParse(today, out var t)
            ? Math.Max(0, (int)(t - d).TotalDays)
            : 0;

    private RentInstallment() { }

    public RentInstallment(Guid contractId, int installmentNumber, string dueDate, decimal amount)
    {
        ContractId = contractId;
        InstallmentNumber = installmentNumber;
        DueDate = dueDate;
        Amount = amount;
    }

    public void RecordPayment(decimal amount, string paidDate, string? method, string? reference, string? notes)
    {
        AmountPaid += amount;
        PaidDate = paidDate;
        PaymentMethod = method;
        Reference = reference;
        if (!string.IsNullOrWhiteSpace(notes)) Notes = notes;

        // Tolerance: a bank transfer settling 0.004 short must not leave the row forever "partial"
        // and forever generating overdue reminders.
        Status = AmountPaid >= Amount - 0.01m ? "paid" : AmountPaid > 0 ? "partial" : "pending";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Waive(string? reason)
    {
        Status = "waived";
        if (!string.IsNullOrWhiteSpace(reason)) Notes = reason;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>The lease ends before this payment falls due. Only an untouched payment can be
    /// cancelled: one with money against it stays as it is and the settlement accounts for it.</summary>
    public bool Cancel(string? reason)
    {
        if (IsSettled || AmountPaid > 0) return false;
        Status = "cancelled";
        if (!string.IsNullOrWhiteSpace(reason)) Notes = reason;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    /// <summary>Undoes <see cref="Cancel"/> when a termination notice is withdrawn.</summary>
    public void Reinstate()
    {
        if (Status != "cancelled") return;
        Status = "pending";
        Notes = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
