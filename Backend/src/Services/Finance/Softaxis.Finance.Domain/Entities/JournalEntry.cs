using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.Finance.Domain.Entities;

public sealed class JournalEntry
{
    private JournalEntry() { }

    public JournalEntry(
        string date, string description, string? reference, string? notes,
        string? createdByUserId = null, string? createdByName = null)
    {
        Id              = Guid.NewGuid();
        EntryNumber     = $"JE-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Date            = date;           // yyyy-MM-dd
        Description     = description.Trim();
        Reference       = reference?.Trim();
        Notes           = notes?.Trim();
        Status          = "draft";        // draft | posted | reversed
        CreatedAt       = DateTime.UtcNow;
        CreatedByUserId = createdByUserId;
        CreatedByName   = createdByName?.Trim();
    }

    public Guid      Id          { get; private set; }
    public string    EntryNumber { get; private set; } = string.Empty;
    public string    Date        { get; private set; } = string.Empty;
    public string    Description { get; private set; } = string.Empty;
    public string?   Reference   { get; private set; }
    public string    CurrencyCode { get; private set; } = TenantCurrency.Resolve();
    public string    Status      { get; private set; } = "draft";
    public string?   Notes       { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    public bool      IsDeleted   { get; private set; }
    public string?   CreatedByUserId { get; private set; }
    public string?   CreatedByName   { get; private set; }

    public ICollection<JournalEntryLine> Lines { get; private set; } = new List<JournalEntryLine>();

    public decimal TotalDebit  => Lines.Sum(l => l.DebitAmount);
    public decimal TotalCredit => Lines.Sum(l => l.CreditAmount);
    public bool    IsBalanced  => TotalDebit == TotalCredit;

    public void Post()
    {
        if (!IsBalanced) throw new InvalidOperationException("Journal entry debits must equal credits before posting.");
        Status    = "posted";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Void()
    {
        Status    = "reversed";
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }
}

public sealed class JournalEntryLine
{
    private JournalEntryLine() { }

    public JournalEntryLine(
        Guid    journalEntryId,
        Guid    accountId,
        string  accountName,
        decimal debitAmount,
        decimal creditAmount,
        string? description)
    {
        if (debitAmount > 0 && creditAmount > 0)
            throw new InvalidOperationException("A journal line cannot have both a debit and a credit amount.");
        if (debitAmount <= 0 && creditAmount <= 0)
            throw new InvalidOperationException("A journal line must have either a debit or a credit amount.");

        Id             = Guid.NewGuid();
        JournalEntryId = journalEntryId;
        AccountId      = accountId;
        AccountName    = accountName.Trim();
        DebitAmount    = debitAmount;
        CreditAmount   = creditAmount;
        Description    = description?.Trim();
    }

    public Guid    Id             { get; private set; }
    public Guid    JournalEntryId { get; private set; }
    public Guid    AccountId      { get; private set; }
    public string  AccountName    { get; private set; } = string.Empty;
    public decimal DebitAmount    { get; private set; }
    public decimal CreditAmount   { get; private set; }
    public string? Description    { get; private set; }

    public JournalEntry? JournalEntry { get; private set; }
    public Account?      Account      { get; private set; }
}
