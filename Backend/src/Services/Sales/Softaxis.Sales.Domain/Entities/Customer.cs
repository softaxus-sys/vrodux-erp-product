namespace Softaxis.Sales.Domain.Entities;

public sealed class Customer
{
    private Customer() { }

    public Customer(string name, string? email, string? phone, string? address,
        string? taxNumber, string? notes)
    {
        Id        = Guid.NewGuid();
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        TaxNumber = taxNumber?.Trim();
        Notes     = notes?.Trim();
        IsActive  = true;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid     Id        { get; private set; }
    public string   Name      { get; private set; } = string.Empty;
    public string?  Email     { get; private set; }
    public string?  Phone     { get; private set; }
    public string?  Address   { get; private set; }
    public string?  TaxNumber { get; private set; }
    public string?  Notes     { get; private set; }
    public bool     IsActive  { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public ICollection<SalesOrder>     SalesOrders     { get; private set; } = new List<SalesOrder>();
    public ICollection<SalesQuotation> SalesQuotations { get; private set; } = new List<SalesQuotation>();

    public void Update(string name, string? email, string? phone, string? address,
        string? taxNumber, string? notes, bool isActive)
    {
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        TaxNumber = taxNumber?.Trim();
        Notes     = notes?.Trim();
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
