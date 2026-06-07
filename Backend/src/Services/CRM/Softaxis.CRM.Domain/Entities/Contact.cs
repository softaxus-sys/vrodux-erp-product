namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// A person belonging to a customer/account (B2B contact). Multiple contacts
/// per account; one can be flagged primary.
/// </summary>
public sealed class Contact
{
    private Contact() { }

    public Contact(Guid customerId, string firstName, string lastName, string title,
        string email, string phone, string? department, bool isPrimary, string? notes)
    {
        Id          = Guid.NewGuid();
        CustomerId  = customerId;
        FirstName   = firstName.Trim();
        LastName    = lastName.Trim();
        Title       = title.Trim();
        Email       = email.Trim().ToLowerInvariant();
        Phone       = phone.Trim();
        Department  = department?.Trim();
        IsPrimary   = isPrimary;
        Notes       = notes?.Trim();
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id         { get; private set; }
    public Guid      CustomerId { get; private set; }
    public string    FirstName  { get; private set; } = string.Empty;
    public string    LastName   { get; private set; } = string.Empty;
    public string    FullName   => $"{FirstName} {LastName}".Trim();
    public string    Title      { get; private set; } = string.Empty;
    public string    Email      { get; private set; } = string.Empty;
    public string    Phone      { get; private set; } = string.Empty;
    public string?   Department { get; private set; }
    public bool      IsPrimary  { get; private set; }
    public string?   Notes      { get; private set; }
    public bool      IsDeleted  { get; private set; }
    public DateTime  CreatedAt  { get; private set; }
    public DateTime? UpdatedAt  { get; private set; }

    public void Update(string firstName, string lastName, string title, string email,
        string phone, string? department, bool isPrimary, string? notes)
    {
        FirstName = firstName.Trim(); LastName = lastName.Trim(); Title = title.Trim();
        Email = email.Trim().ToLowerInvariant(); Phone = phone.Trim();
        Department = department?.Trim(); IsPrimary = isPrimary; Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetPrimary(bool value) { IsPrimary = value; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
