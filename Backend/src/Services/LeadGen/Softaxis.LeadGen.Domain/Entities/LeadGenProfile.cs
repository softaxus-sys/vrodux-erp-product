namespace Softaxis.LeadGen.Domain.Entities;

/// <summary>
/// What a workspace sells and to whom. One row per workspace, created on first read (never at
/// startup — a startup seed has no tenant). It steers fit scoring and gives outreach its sender
/// identity, which a cold email must carry (a real business name and a postal address).
/// </summary>
public sealed class LeadGenProfile
{
    private LeadGenProfile() { }
    public static LeadGenProfile CreateEmpty() => new() { Id = Guid.NewGuid() };

    public Guid      Id               { get; private set; }
    /// <summary>One or two sentences: what the business sells.</summary>
    public string?   OfferSummary     { get; private set; }
    /// <summary>Who buys it, in the owner's words.</summary>
    public string?   TargetCustomers  { get; private set; }
    public string?   DealSize         { get; private set; }
    public string    CountryCode      { get; private set; } = "AE";
    /// <summary>JSON array of region names the owner usually sells in.</summary>
    public string?   PreferredRegions { get; private set; }
    /// <summary>JSON array of category keys the owner usually targets.</summary>
    public string?   PreferredCategories { get; private set; }
    /// <summary>Comma separated words. A business whose name or category contains one is ranked down.</summary>
    public string?   ExcludeKeywords  { get; private set; }

    // Sender identity for outreach footers.
    public string?   SenderBusinessName { get; private set; }
    public string?   SenderAddress      { get; private set; }
    public string?   SenderWebsite      { get; private set; }

    public DateTime  CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; private set; }

    public void Update(string? offer, string? target, string? dealSize, string countryCode,
        string? regionsJson, string? categoriesJson, string? exclude,
        string? senderName, string? senderAddress, string? senderWebsite)
    {
        OfferSummary        = Text.OrNull(offer);
        TargetCustomers     = Text.OrNull(target);
        DealSize            = Text.OrNull(dealSize);
        CountryCode         = string.IsNullOrWhiteSpace(countryCode) ? "AE" : countryCode.Trim().ToUpperInvariant();
        PreferredRegions    = Text.OrNull(regionsJson);
        PreferredCategories = Text.OrNull(categoriesJson);
        ExcludeKeywords     = Text.OrNull(exclude);
        SenderBusinessName  = Text.OrNull(senderName);
        SenderAddress       = Text.OrNull(senderAddress);
        SenderWebsite       = Text.OrNull(senderWebsite);
        UpdatedAt           = DateTime.UtcNow;
    }

    /// <summary>
    /// Fills fields that are still blank from what the workspace already told us. Never overwrites a value
    /// and does not mark the profile as saved by the owner. Returns whether anything changed.
    /// </summary>
    public bool ApplyDefaults(string? senderName, string? senderAddress, string? senderWebsite, string? countryCode,
        string? offer, string? targetCustomers, string? categoriesJson)
    {
        var changed = false;
        string? Fill(string? field, string? value)
        {
            if (string.IsNullOrWhiteSpace(field) && !string.IsNullOrWhiteSpace(value)) { changed = true; return Text.OrNull(value); }
            return field;
        }
        SenderBusinessName  = Fill(SenderBusinessName, senderName);
        SenderAddress       = Fill(SenderAddress, senderAddress);
        SenderWebsite       = Fill(SenderWebsite, senderWebsite);
        OfferSummary        = Fill(OfferSummary, offer);
        TargetCustomers     = Fill(TargetCustomers, targetCustomers);
        PreferredCategories = Fill(PreferredCategories, categoriesJson);
        if (UpdatedAt is null && !string.IsNullOrWhiteSpace(countryCode)
            && !string.Equals(CountryCode, countryCode, StringComparison.OrdinalIgnoreCase))
        { CountryCode = countryCode.Trim().ToUpperInvariant(); changed = true; }
        return changed;
    }
}
