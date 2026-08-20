namespace Softaxis.CRM.Domain.Entities;

public sealed class CrmCustomer
{
    private CrmCustomer() { }
    public CrmCustomer(string name, string industry, string country, string city, string address,
        string phone, string email, string tier, string accountManager, string description,
        Guid? accountManagerUserId = null)
    {
        Id             = Guid.NewGuid();
        Name           = name.Trim(); Industry = industry.Trim();
        Country        = country; City = city; Address = address.Trim();
        Phone          = phone.Trim(); Email = email.Trim().ToLowerInvariant();
        Status         = "active"; Tier = tier; AccountManager = accountManager.Trim();
        AccountManagerUserId = accountManagerUserId;
        Since          = DateTime.UtcNow.ToString("yyyy-MM-dd");
        TotalRevenue   = 0m; OpenDeals = 0; Currency = "AED";
        Description    = description.Trim(); Tags = [];
        CreatedAt      = DateTime.UtcNow;
    }
    public Guid      Id             { get; private set; }
    public string    Name           { get; private set; } = string.Empty;
    public string?   TradeName      { get; private set; }
    public string    Industry       { get; private set; } = string.Empty;
    public string?   Website        { get; private set; }
    public string    Country        { get; private set; } = string.Empty;
    public string    City           { get; private set; } = string.Empty;
    public string    Address        { get; private set; } = string.Empty;
    public string    Phone          { get; private set; } = string.Empty;
    public string    Email          { get; private set; } = string.Empty;
    public string    Status         { get; private set; } = "active";
    public string    Tier           { get; private set; } = "standard";
    public string    AccountManager { get; private set; } = string.Empty;
    /// <summary>Owning user. Drives the assigned-only / my-team visibility tiers; null = unassigned.</summary>
    public Guid?     AccountManagerUserId { get; private set; }
    public string    Since          { get; private set; } = string.Empty;
    public string?   LastActivity   { get; private set; }
    public decimal   TotalRevenue   { get; private set; }
    public int       OpenDeals      { get; private set; }
    public string    Currency       { get; private set; } = "AED";
    public string?   Employees      { get; private set; }
    public string    Description    { get; private set; } = string.Empty;
    public List<string> Tags        { get; private set; } = [];
    public string?   ContractRenewal{ get; private set; }
    public int?      NpsScore       { get; private set; }
    public bool      IsDeleted      { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }
    public void UpdateRevenue(decimal amount) { TotalRevenue = amount; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void Update(string name, string industry, string country, string city, string address,
        string phone, string email, string status, string tier, string accountManager, string description,
        string? website, string? tradeName, string? employees, int? npsScore, string? contractRenewal, List<string>? tags,
        Guid? accountManagerUserId = null)
    {
        Name = name.Trim(); Industry = industry.Trim(); Country = country; City = city;
        Address = address.Trim(); Phone = phone.Trim(); Email = email.Trim().ToLowerInvariant();
        Status = status; Tier = tier; AccountManager = accountManager.Trim(); Description = description.Trim();
        AccountManagerUserId = accountManagerUserId;
        Website = website; TradeName = tradeName; Employees = employees;
        NpsScore = npsScore; ContractRenewal = contractRenewal;
        if (tags is not null) Tags = tags;
        UpdatedAt = DateTime.UtcNow;
    }
}
