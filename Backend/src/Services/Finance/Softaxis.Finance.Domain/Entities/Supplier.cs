namespace Softaxis.Finance.Domain.Entities;

/// <summary>AP supplier master, linked to a Chart-of-Accounts payable account.</summary>
public sealed class Supplier
{
    private Supplier() { }

    public Supplier(
        string  name,
        string? email,
        string? phone,
        string? address,
        string? taxNumber,
        Guid?   accountId)
    {
        Id        = Guid.NewGuid();
        Code      = $"SUPP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        TaxNumber = NormalizeTaxNumber(taxNumber);
        AccountId = accountId;
        IsActive  = true;
        CreatedAt = DateTime.UtcNow;
    }

    public Guid      Id        { get; private set; }
    public string    Code      { get; private set; } = string.Empty;
    public string    Name      { get; private set; } = string.Empty;
    public string?   Email     { get; private set; }
    public string?   Phone     { get; private set; }
    public string?   Address   { get; private set; }
    /// <summary>Tax registration number (UAE TRN, VAT no., GSTIN, …). Kept as entered, minus spacing.</summary>
    public string?   TaxNumber { get; private set; }
    public Guid?     AccountId { get; private set; }
    public bool      IsActive  { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public void Update(string name, string? email, string? phone, string? address,
                       string? taxNumber, Guid? accountId, bool isActive)
    {
        Name      = name.Trim();
        Email     = email?.Trim().ToLowerInvariant();
        Phone     = phone?.Trim();
        Address   = address?.Trim();
        TaxNumber = NormalizeTaxNumber(taxNumber);
        AccountId = accountId;
        IsActive  = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>
    /// Strips whitespace so "100 1234 5678 0003" and "100123456780003" are the same number —
    /// a TRN is routinely written with grouping spaces, and two spellings of one registration
    /// would defeat any later duplicate check and print inconsistently on documents.
    /// Blank becomes null so "not provided" is one value rather than two.
    /// </summary>
    private static string? NormalizeTaxNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var compact = new string(value.Where(c => !char.IsWhiteSpace(c)).ToArray());
        return compact.Length == 0 ? null : compact;
    }
}
