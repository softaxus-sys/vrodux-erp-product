namespace Softaxis.Inventory.Domain.Entities;

public sealed class Brand
{
    private Brand() { }

    public Brand(string name, string? code, string? description, string? logoUrl)
    {
        Id          = Guid.NewGuid();
        Name        = name.Trim();
        Code        = code?.Trim().ToUpperInvariant();
        Description = description?.Trim();
        LogoUrl     = logoUrl?.Trim();
        IsActive    = true;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public string    Name        { get; private set; } = string.Empty;
    public string?   Code        { get; private set; }
    public string?   Description { get; private set; }
    public string?   LogoUrl     { get; private set; }
    public bool      IsActive    { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    public bool      IsDeleted   { get; private set; }

    public ICollection<Product> Products { get; private set; } = new List<Product>();

    public void Update(string name, string? code, string? description, string? logoUrl, bool isActive)
    {
        Name        = name.Trim();
        Code        = code?.Trim().ToUpperInvariant();
        Description = description?.Trim();
        LogoUrl     = logoUrl?.Trim();
        IsActive    = isActive;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
