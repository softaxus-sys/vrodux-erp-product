namespace Softaxis.Finance.Domain.Entities;

/// <summary>Lookup master for the five fundamental account classifications.</summary>
public sealed class AccountType
{
    private AccountType() { }

    public AccountType(string code, string name, string normalBalance, int sortOrder, Guid? parentId = null)
    {
        Id            = Guid.NewGuid();
        Code          = code.Trim().ToLowerInvariant();
        Name          = name.Trim();
        NormalBalance = normalBalance;  // "debit" | "credit"
        SortOrder     = sortOrder;
        ParentId      = parentId;
        IsActive      = true;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    Code          { get; private set; } = string.Empty;
    public string    Name          { get; private set; } = string.Empty;
    public string    NormalBalance { get; private set; } = string.Empty;
    public Guid?     ParentId      { get; private set; }
    public int       SortOrder     { get; private set; }
    public bool      IsActive      { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public void Rename(string name) { Name = name.Trim(); UpdatedAt = DateTime.UtcNow; }

    public void SetNormalBalance(string normalBalance) { NormalBalance = normalBalance; UpdatedAt = DateTime.UtcNow; }

    public void SetActive(bool isActive) { IsActive = isActive; UpdatedAt = DateTime.UtcNow; }

    public void SetSortOrder(int sortOrder) { SortOrder = sortOrder; UpdatedAt = DateTime.UtcNow; }
}
