namespace Softaxis.Finance.Domain.Entities;

/// <summary>AR customer master, linked to a Chart-of-Accounts receivable account.</summary>
public sealed class Customer
{
    private Customer() { }

    public Customer(
        string  name,
        string? email,
        string? phone,
        string? address,
        Guid?   accountId)
    {
        Id        = Guid.NewGuid();
        Code      = $"CUST-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        AccountId = accountId;
        IsActive  = true;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id        { get; private set; }
    public string    Code      { get; private set; } = string.Empty;
    public string    Name      { get; private set; } = string.Empty;
    public string?   Email     { get; private set; }
    public string?   Phone     { get; private set; }
    public string?   Address   { get; private set; }
    public Guid?     AccountId { get; private set; }
    public bool      IsActive  { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public void Update(string name, string? email, string? phone, string? address, Guid? accountId, bool isActive)
    {
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        AccountId = accountId;
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
