using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.Finance.Domain.Entities;

public sealed class Account
{
    private Account() { }

    public Account(
        string  accountNumber,
        string  name,
        string  accountType,
        string? description,
        Guid?   parentId)
    {
        Id            = Guid.NewGuid();
        AccountNumber = accountNumber.Trim();
        Name          = name.Trim();
        AccountType   = accountType;  // asset | liability | equity | income | expense
        Description   = description?.Trim();
        ParentId      = parentId;
        IsActive      = true;
        Balance       = 0m;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    AccountNumber { get; private set; } = string.Empty;
    public string    Name          { get; private set; } = string.Empty;
    public string    AccountType   { get; private set; } = string.Empty;
    public string?   Description   { get; private set; }
    public Guid?     ParentId      { get; private set; }
    public Guid?     AccountTypeId { get; private set; }
    public string    CurrencyCode  { get; private set; } = TenantCurrency.Resolve();
    public bool      IsActive      { get; private set; }
    public decimal   Balance       { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
    public bool      IsDeleted     { get; private set; }

    public ICollection<JournalEntryLine> JournalLines { get; private set; } = new List<JournalEntryLine>();

    public void Update(string accountNumber, string name, string accountType, string? description, Guid? parentId, bool isActive)
    {
        AccountNumber = accountNumber.Trim();
        Name          = name.Trim();
        AccountType   = accountType;
        Description   = description?.Trim();
        ParentId      = parentId;
        IsActive      = isActive;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void AdjustBalance(decimal amount) { Balance += amount; UpdatedAt = DateTime.UtcNow; }

    public void SetAccountTypeId(Guid? accountTypeId) { AccountTypeId = accountTypeId; UpdatedAt = DateTime.UtcNow; }

    public void SetCurrencyCode(string currencyCode) { CurrencyCode = currencyCode.Trim().ToUpperInvariant(); UpdatedAt = DateTime.UtcNow; }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
