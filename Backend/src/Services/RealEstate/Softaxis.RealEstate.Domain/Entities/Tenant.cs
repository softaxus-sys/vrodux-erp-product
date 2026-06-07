namespace Softaxis.RealEstate.Domain.Entities;

public sealed class Tenant
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string TenantNumber { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public string TenantType { get; private set; } = null!; // individual/company
    public string Email { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public string? NationalId { get; private set; }
    public string? CompanyName { get; private set; }
    public string? TradeLicense { get; private set; }
    public string Nationality { get; private set; } = null!;
    public string Status { get; private set; } = "active"; // active/inactive/blacklisted
    public int ActiveContracts { get; private set; }
    public decimal TotalPaid { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Tenant(string name, string tenantType, string email, string phone, string nationality,
        string? nationalId, string? companyName, string? tradeLicense)
    {
        TenantNumber = $"TEN-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        Name = name; TenantType = tenantType; Email = email; Phone = phone; Nationality = nationality;
        NationalId = nationalId; CompanyName = companyName; TradeLicense = tradeLicense;
    }

    public void UpdateStats(int activeContracts, decimal totalPaid)
    {
        ActiveContracts = activeContracts; TotalPaid = totalPaid; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
