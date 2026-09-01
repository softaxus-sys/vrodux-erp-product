namespace Softaxis.Finance.Domain.Entities;

/// <summary>AR customer master, linked to a Chart-of-Accounts receivable account.</summary>
public sealed class Customer
{
    private Customer() { }

    public Customer(
        string  name,
        string? email,
        string? phone,
        string? address,
        Guid?   accountId,
        string? ccEmails = null)
    {
        Id        = Guid.NewGuid();
        Code      = $"CUST-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        AccountId = accountId;
        CcEmails  = NormaliseCc(ccEmails);
        IsActive  = true;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id        { get; private set; }
    public string    Code      { get; private set; } = string.Empty;
    public string    Name      { get; private set; } = string.Empty;
    public string?   Email     { get; private set; }
    public string?   Phone     { get; private set; }
    public string?   Address   { get; private set; }
    public Guid?     AccountId { get; private set; }
    public bool      IsActive  { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public void Update(string name, string? email, string? phone, string? address, Guid? accountId, bool isActive,
        string? ccEmails = null)
    {
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        AccountId = accountId;
        CcEmails  = NormaliseCc(ccEmails);
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// The customer''s own people to copy on everything sent to them — their accounts inbox, a
    /// procurement contact, whoever actually pays. Separate from the workspace CC list, which
    /// copies OUR side. Stored as typed; split on read.
    /// </summary>
    public string? CcEmails { get; private set; }

    /// <summary>
    /// Accepts commas and semicolons because people paste from both. One stray separator would
    /// otherwise yield "a@x.com;b@y.com" as a single address, which no mail server accepts.
    /// </summary>
    public IReadOnlyList<string> CcList =>
        (CcEmails ?? string.Empty)
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private static string? NormaliseCc(string? raw) =>
        string.IsNullOrWhiteSpace(raw) ? null : string.Join(", ",
            raw.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
               .Select(x => x.ToLowerInvariant())
               .Distinct(StringComparer.OrdinalIgnoreCase));

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
