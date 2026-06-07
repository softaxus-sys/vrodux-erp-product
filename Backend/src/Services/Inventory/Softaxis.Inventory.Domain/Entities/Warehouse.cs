namespace Softaxis.Inventory.Domain.Entities;

public sealed class Warehouse
{
    private Warehouse() { }

    public Warehouse(string name, string? code, string? address, string? contactPerson, string? phone)
    {
        Id            = Guid.NewGuid();
        Name          = name.Trim();
        Code          = code?.Trim().ToUpperInvariant();
        Address       = address?.Trim();
        ContactPerson = contactPerson?.Trim();
        Phone         = phone?.Trim();
        IsActive      = true;
        IsDefault     = false;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public string   Name          { get; private set; } = string.Empty;
    public string?  Code          { get; private set; }
    public string?  Address       { get; private set; }
    public string?  ContactPerson { get; private set; }
    public string?  Phone         { get; private set; }
    public bool     IsActive      { get; private set; }
    public bool     IsDefault     { get; private set; }
    public DateTime  CreatedAt    { get; private set; }
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public ICollection<StockMovement> StockMovements { get; private set; } = new List<StockMovement>();

    public void Update(string name, string? code, string? address, string? contactPerson, string? phone, bool isActive)
    {
        Name          = name.Trim();
        Code          = code?.Trim().ToUpperInvariant();
        Address       = address?.Trim();
        ContactPerson = contactPerson?.Trim();
        Phone         = phone?.Trim();
        IsActive      = isActive;
        UpdatedAt     = DateTime.UtcNow;
    }

    public void SetDefault() { IsDefault = true; UpdatedAt = DateTime.UtcNow; }
    public void Delete()     { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
