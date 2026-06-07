namespace Softaxis.Inventory.Domain.Entities;

public sealed class ProductCategory
{
    private ProductCategory() { }

    public ProductCategory(string name, string? code, string? description, string? parentId)
    {
        Id          = Guid.NewGuid();
        Name        = name.Trim();
        Code        = code?.Trim().ToUpperInvariant();
        Description = description?.Trim();
        ParentId    = string.IsNullOrWhiteSpace(parentId) ? null : parentId.Trim();
        IsActive    = true;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid     Id          { get; private set; }
    public string   Name        { get; private set; } = string.Empty;
    public string?  Code        { get; private set; }
    public string?  Description { get; private set; }
    public string?  ParentId    { get; private set; }
    public bool     IsActive    { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }
    public bool      IsDeleted  { get; private set; }

    public ICollection<Product> Products { get; private set; } = new List<Product>();

    public void Update(string name, string? code, string? description, string? parentId, bool isActive)
    {
        Name        = name.Trim();
        Code        = code?.Trim().ToUpperInvariant();
        Description = description?.Trim();
        ParentId    = string.IsNullOrWhiteSpace(parentId) ? null : parentId.Trim();
        IsActive    = isActive;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
