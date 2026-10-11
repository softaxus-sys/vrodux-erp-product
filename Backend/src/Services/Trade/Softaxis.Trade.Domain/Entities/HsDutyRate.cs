namespace Softaxis.Trade.Domain.Entities;

/// <summary>
/// The customs duty rate for a tariff (HS) code, as a percentage of customs value. A rate for
/// "7306" covers every code that starts with those digits ("7306.30", "7306.30.10"…) unless a more
/// specific rate exists — the longest matching code wins, the way a tariff schedule reads.
/// </summary>
public sealed class HsDutyRate
{
    private HsDutyRate() { }

    public HsDutyRate(string hsCode, string? description, decimal dutyPercent, string? notes)
    {
        Id = Guid.NewGuid();
        Set(hsCode, description, dutyPercent, notes);
    }

    public Guid      Id          { get; private set; }

    /// <summary>The code as the user typed it ("7306.30"), kept for display.</summary>
    public string    HsCode      { get; private set; } = null!;

    /// <summary>Digits only ("730630") — what matching and uniqueness use, so "7306.30" and "730630" are one code.</summary>
    public string    HsDigits    { get; private set; } = null!;

    public string?   Description { get; private set; }
    public decimal   DutyPercent { get; private set; }
    public string?   Notes       { get; private set; }
    public bool      IsDeleted   { get; private set; }
    public DateTime  CreatedAt   { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt   { get; private set; }

    public void Update(string hsCode, string? description, decimal dutyPercent, string? notes)
    {
        Set(hsCode, description, dutyPercent, notes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    public static string Digits(string? code) => new((code ?? "").Where(char.IsDigit).ToArray());

    /// <summary>
    /// The most specific rate whose digits are a prefix of the item's code, or null. Items with no
    /// code, or a code shorter than any rate, match nothing — a guess here would be a wrong duty.
    /// </summary>
    public static HsDutyRate? Match(IEnumerable<HsDutyRate> rates, string? itemCode)
    {
        var d = Digits(itemCode);
        if (d.Length == 0) return null;
        return rates.Where(r => d.StartsWith(r.HsDigits, StringComparison.Ordinal))
                    .OrderByDescending(r => r.HsDigits.Length)
                    .FirstOrDefault();
    }

    private void Set(string hsCode, string? description, decimal dutyPercent, string? notes)
    {
        HsCode      = hsCode.Trim();
        HsDigits    = Digits(hsCode);
        Description = Text.OrNull(description);
        DutyPercent = dutyPercent;
        Notes       = Text.OrNull(notes);
    }
}
