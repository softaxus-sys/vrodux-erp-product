namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Represents a physical office or branch location.
/// </summary>
public sealed class Branch
{
    private Branch() { }

    public Branch(
        string code, string name, string type,
        string city, string country, string flag,
        string? address, string? phone, string? email,
        string? manager, int staff,
        string status, string currency, string timezone,
        string? openedDate,
        Guid?   tenantId = null)
    {
        Id         = Guid.NewGuid();
        TenantId   = tenantId;
        Code       = code.Trim().ToUpperInvariant();
        Name       = name.Trim();
        Type       = type;
        City       = city.Trim();
        Country    = country.Trim();
        Flag       = flag;
        Address    = address?.Trim();
        Phone      = phone?.Trim();
        Email      = email?.Trim().ToLowerInvariant();
        Manager    = manager?.Trim();
        Staff      = staff;
        Status     = status;
        Currency   = currency;
        Timezone   = timezone;
        OpenedDate = openedDate;
        CreatedAt  = DateTime.UtcNow;
    }

    public Guid    Id         { get; private set; }
    /// <summary>
    /// Owning tenant. Follows <see cref="Role"/>/<see cref="Team"/>: NULL means a legacy/global
    /// row, which is hidden from every tenant's list. Branches were global before this — one
    /// tenant could see and collide with another tenant's branch codes.
    /// </summary>
    public Guid?    TenantId   { get; private set; }
    public string  Code       { get; private set; } = string.Empty;
    public string  Name       { get; private set; } = string.Empty;
    public string  Type       { get; private set; } = "regional";  // main | regional | international
    public string  City       { get; private set; } = string.Empty;
    public string  Country    { get; private set; } = string.Empty;
    public string  Flag       { get; private set; } = string.Empty;
    public string? Address    { get; private set; }
    public string? Phone      { get; private set; }
    public string? Email      { get; private set; }
    public string? Manager    { get; private set; }
    public int     Staff      { get; private set; }
    public string  Status     { get; private set; } = "active";    // active | inactive
    public string  Currency   { get; private set; } = "PKR";
    public string  Timezone   { get; private set; } = "Asia/Karachi (UTC+5)";
    public string? OpenedDate { get; private set; }                // ISO date string

    /// <summary>
    /// Where this branch's live data is written: <c>cloud</c> (devices talk to erp.vrodux.com, as always) or
    /// <c>local</c> (the branch has its own server; the cloud keeps a synced copy and refuses direct
    /// operational writes for it). Changed deliberately, at a quiet time. docs/branch-server-design.md §7.
    /// </summary>
    public string ServerMode { get; private set; } = "cloud";

    public void SetServerMode(string mode) { ServerMode = mode; UpdatedAt = DateTime.UtcNow; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public void Update(
        string code, string name, string type,
        string city, string country, string flag,
        string? address, string? phone, string? email,
        string? manager, int staff,
        string status, string currency, string timezone,
        string? openedDate)
    {
        Code       = code.Trim().ToUpperInvariant();
        Name       = name.Trim();
        Type       = type;
        City       = city.Trim();
        Country    = country.Trim();
        Flag       = flag;
        Address    = address?.Trim();
        Phone      = phone?.Trim();
        Email      = email?.Trim().ToLowerInvariant();
        Manager    = manager?.Trim();
        Staff      = staff;
        Status     = status;
        Currency   = currency;
        Timezone   = timezone;
        OpenedDate = openedDate;
        UpdatedAt  = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public void SetTenant(Guid? tenantId) => TenantId = tenantId;

}
