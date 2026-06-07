namespace Softaxis.Inventory.Domain.Entities;

public sealed class UnitOfMeasure
{
    private UnitOfMeasure() { }

    public UnitOfMeasure(string name, string symbol, string? description)
    {
        Id          = Guid.NewGuid();
        Name        = name.Trim();
        Symbol      = symbol.Trim();
        Description = description?.Trim();
        IsActive    = true;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public string    Name        { get; private set; } = string.Empty;
    public string    Symbol      { get; private set; } = string.Empty;
    public string?   Description { get; private set; }
    public bool      IsActive    { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    public bool      IsDeleted   { get; private set; }

    public ICollection<Product> Products { get; private set; } = new List<Product>();

    public void Update(string name, string symbol, string? description, bool isActive)
    {
        Name        = name.Trim();
        Symbol      = symbol.Trim();
        Description = description?.Trim();
        IsActive    = isActive;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
