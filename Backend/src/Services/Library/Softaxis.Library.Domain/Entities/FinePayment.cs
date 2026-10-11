namespace Softaxis.Library.Domain.Entities;

/// <summary>
/// One amount taken against a fine. A fine can be paid in parts, and the fine itself only carries
/// the running total — so without these rows nobody could say how much was collected on a given
/// day, or which money has already been entered in the accounts.
/// </summary>
public sealed class FinePayment
{
    private FinePayment() { }

    public FinePayment(Guid fineId, Guid memberId, decimal amount, string? method, string paidOn)
    {
        Id       = Guid.NewGuid();
        FineId   = fineId;
        MemberId = memberId;
        Amount   = amount;
        Method   = string.IsNullOrWhiteSpace(method) ? "cash" : method.Trim().ToLowerInvariant();
        PaidOn   = paidOn;
    }

    public Guid      Id                 { get; private set; }
    public Guid      FineId             { get; private set; }
    public Guid      MemberId           { get; private set; }
    public decimal   Amount             { get; private set; }
    public string    Method             { get; private set; } = "cash";
    /// <summary>yyyy-MM-dd, the desk's own date.</summary>
    public string    PaidOn             { get; private set; } = null!;
    /// <summary>The Finance journal entry this payment was included in. Null = not in the accounts yet.</summary>
    public Guid?     JournalEntryId     { get; private set; }
    public string?   JournalEntryNumber { get; private set; }
    public DateTime? PostedAt           { get; private set; }
    public DateTime  CreatedAt          { get; private set; } = DateTime.UtcNow;

    public bool IsPosted => JournalEntryId is not null;

    public void MarkPosted(Guid journalEntryId, string? journalEntryNumber)
    {
        JournalEntryId     = journalEntryId;
        JournalEntryNumber = string.IsNullOrWhiteSpace(journalEntryNumber) ? null : journalEntryNumber.Trim();
        PostedAt           = DateTime.UtcNow;
    }
}
