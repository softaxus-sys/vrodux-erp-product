namespace Softaxis.Finance.Domain.Entities;

/// <summary>Lookup master for the five fundamental account classifications.</summary>
public sealed class AccountType
{
    private AccountType() { }

    public AccountType(string code, string name, string normalBalance, int sortOrder)
    {
        Id            = Guid.NewGuid();
        Code          = code.Trim().ToLowerInvariant();
        Name          = name.Trim();
        NormalBalance = normalBalance;  // "debit" | "credit"
        SortOrder     = sortOrder;
        IsActive      = true;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    Code          { get; private set; } = string.Empty;
    public string    Name          { get; private set; } = string.Empty;
    public string    NormalBalance { get; private set; } = string.Empty;
    public int       SortOrder     { get; private set; }
    public bool      IsActive      { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }
}
