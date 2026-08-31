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

    // The Add Tenant form has always collected these six. There was nowhere to put them, so every
    // one was silently discarded on save — the same class of bug as the payroll allowances in
    // Module 3. A form that asks for an emergency contact has to keep it.
    public string? PassportNumber   { get; private set; }
    public string? Trn              { get; private set; }
    public string? Occupation       { get; private set; }
    public decimal? MonthlyIncome   { get; private set; }
    public string? EmergencyContact { get; private set; }
    public string? Notes            { get; private set; }

    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    private Tenant() { }

    public Tenant(string name, string tenantType, string email, string phone, string nationality,
        string? nationalId, string? companyName, string? tradeLicense)
    {
        TenantNumber = $"TEN-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        Name = name; TenantType = tenantType; Email = email; Phone = phone; Nationality = nationality;
        NationalId = nationalId; CompanyName = companyName; TradeLicense = tradeLicense;
    }

    /// <summary>The optional detail fields, kept off the constructor so it stays readable.</summary>
    public void SetProfile(string? passportNumber, string? trn, string? occupation,
        decimal? monthlyIncome, string? emergencyContact, string? notes)
    {
        PassportNumber   = Trim(passportNumber);
        Trn              = Trim(trn);
        Occupation       = Trim(occupation);
        MonthlyIncome    = monthlyIncome;
        EmergencyContact = Trim(emergencyContact);
        Notes            = Trim(notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Update(string name, string tenantType, string email, string phone, string nationality,
        string? nationalId, string? companyName, string? tradeLicense)
    {
        Name = name; TenantType = tenantType; Email = email; Phone = phone; Nationality = nationality;
        NationalId = Trim(nationalId); CompanyName = Trim(companyName); TradeLicense = Trim(tradeLicense);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Unknown values are ignored rather than stored — a bad status would otherwise make
    /// the tenant invisible to every status filter in the UI.</summary>
    public void SetStatus(string? status)
    {
        var s = (status ?? string.Empty).Trim().ToLowerInvariant();
        if (s is "active" or "inactive" or "blacklisted") { Status = s; UpdatedAt = DateTime.UtcNow; }
    }

    public void UpdateStats(int activeContracts, decimal totalPaid)
    {
        ActiveContracts = activeContracts; TotalPaid = totalPaid; UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
