namespace Softaxis.HR.Domain.Entities;

public sealed class Department
{
    private Department() { }

    public Department(string name, string? code, string? description)
    {
        Id          = Guid.NewGuid();
        Name        = name.Trim();
        Code        = code?.Trim().ToUpperInvariant();
        Description = description?.Trim();
        IsActive    = true;
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    public string    Name        { get; private set; } = string.Empty;
    public string?   Code        { get; private set; }
    public string?   Description { get; private set; }
    public Guid?     ManagerId   { get; private set; }  // FK to Employee (loose reference)
    public bool      IsActive    { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }
    public bool      IsDeleted   { get; private set; }

    public ICollection<Employee> Employees { get; private set; } = new List<Employee>();

    public void Update(string name, string? code, string? description, Guid? managerId, bool isActive)
    {
        Name        = name.Trim();
        Code        = code?.Trim().ToUpperInvariant();
        Description = description?.Trim();
        ManagerId   = managerId;
        IsActive    = isActive;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
