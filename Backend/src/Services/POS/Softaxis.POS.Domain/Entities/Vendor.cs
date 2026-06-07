namespace Softaxis.POS.Domain.Entities;

public sealed class Vendor
{
    private Vendor() { }

    public Vendor(string name, string? code, string? category, string? contactPerson,
        string? email, string? phone, string? address, string? taxNumber,
        string? paymentTerms, string? currency, string? notes)
    {
        Id            = Guid.NewGuid();
        Name          = name.Trim();
        Code          = code?.Trim().ToUpperInvariant();
        Category      = category ?? "General";
        ContactPerson = contactPerson?.Trim();
        Email         = email?.Trim().ToLowerInvariant();
        Phone         = phone?.Trim();
        Address       = address?.Trim();
        TaxNumber     = taxNumber?.Trim();
        PaymentTerms  = paymentTerms ?? "Net 30";
        Currency      = currency ?? "PKR";
        Notes         = notes?.Trim();
        Status        = "active";
        Rating        = 0;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid    Id            { get; private set; }
    public string  Name          { get; private set; } = string.Empty;
    public string? Code          { get; private set; }
    public string  Category      { get; private set; } = "General";
    public string? ContactPerson { get; private set; }
    public string? Email         { get; private set; }
    public string? Phone         { get; private set; }
    public string? Address       { get; private set; }
    public string? TaxNumber     { get; private set; }
    public string  PaymentTerms  { get; private set; } = "Net 30";
    public string  Currency      { get; private set; } = "PKR";
    public string? Notes         { get; private set; }
    public string  Status        { get; private set; } = "active"; // active | inactive | blocked
    public decimal Rating        { get; private set; }             // 0–5
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    public bool      IsDeleted   { get; private set; }

    public ICollection<PurchaseOrder> PurchaseOrders { get; private set; } = new List<PurchaseOrder>();

    public void Update(string name, string? code, string? category, string? contactPerson,
        string? email, string? phone, string? address, string? taxNumber,
        string? paymentTerms, string? currency, string? notes, string status, decimal rating)
    {
        Name          = name.Trim();
        Code          = code?.Trim().ToUpperInvariant();
        Category      = category ?? "General";
        ContactPerson = contactPerson?.Trim();
        Email         = email?.Trim().ToLowerInvariant();
        Phone         = phone?.Trim();
        Address       = address?.Trim();
        TaxNumber     = taxNumber?.Trim();
        PaymentTerms  = paymentTerms ?? "Net 30";
        Currency      = currency ?? "PKR";
        Notes         = notes?.Trim();
        Status        = status;
        Rating        = Math.Clamp(rating, 0, 5);
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
