namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// How a workspace (BranchId null) or one branch charges tax on restaurant bills, and whether its
/// bills are reported to Pakistan's FBR. A branch row overrides the workspace row; with neither,
/// the workspace country's preset applies (see TaxPresets).
/// </summary>
public sealed class TaxProfile
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid? BranchId { get; private set; }
    /// <summary>ISO 3166 alpha-2, e.g. "PK".</summary>
    public string CountryCode { get; private set; } = null!;
    /// <summary>Preset region code, e.g. "PK-PB" (Punjab); null when the country has a single rate.</summary>
    public string? RegionCode { get; private set; }
    /// <summary>Printed on the bill, e.g. "GST", "VAT", "PST".</summary>
    public string TaxLabel { get; private set; } = "Tax";
    /// <summary>Percent, e.g. 16 for 16%.</summary>
    public decimal RatePercent { get; private set; }

    public bool FbrEnabled { get; private set; }
    /// <summary>"sandbox" | "production".</summary>
    public string FbrEnvironment { get; private set; } = "sandbox";
    /// <summary>The POS ID FBR issued for this outlet.</summary>
    public int? FbrPosId { get; private set; }
    public string? FbrTokenEncrypted { get; private set; }
    /// <summary>FBR's per-invoice POS service fee (Rs. 1), added to every reported bill.</summary>
    public decimal FbrServiceFee { get; private set; } = 1m;
    /// <summary>PCT (HS) code reported on every line.</summary>
    public string FbrPctCode { get; private set; } = "98173000";

    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public TaxProfile(Guid? branchId) { BranchId = branchId; }

    public void SetTax(string countryCode, string? regionCode, string taxLabel, decimal ratePercent)
    {
        CountryCode = countryCode.Trim().ToUpperInvariant();
        RegionCode = string.IsNullOrWhiteSpace(regionCode) ? null : regionCode.Trim();
        TaxLabel = string.IsNullOrWhiteSpace(taxLabel) ? "Tax" : taxLabel.Trim();
        RatePercent = Math.Round(ratePercent, 2);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Token is replaced only when a new one is supplied, so saving other fields never wipes it.</summary>
    public void SetFbr(bool enabled, string environment, int? posId, string? newTokenEncrypted, decimal serviceFee, string pctCode)
    {
        FbrEnabled = enabled;
        FbrEnvironment = environment == "production" ? "production" : "sandbox";
        FbrPosId = posId;
        if (newTokenEncrypted is not null) FbrTokenEncrypted = newTokenEncrypted;
        FbrServiceFee = Math.Max(0, serviceFee);
        FbrPctCode = string.IsNullOrWhiteSpace(pctCode) ? "98173000" : pctCode.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
