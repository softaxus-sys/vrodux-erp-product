namespace Softaxis.LeadGen.Domain.Entities;

// ──────────────────────────────────────────────────────────────────────────────────────────────
// PLATFORM-LEVEL TABLES. None of these belong to a workspace: they are excluded from tenant
// isolation in LeadGenDbContext. What goes in them is deliberately limited to public business
// data and our own configuration — never a workspace's leads, emails or conversations.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/// <summary>A pack of credits a workspace can buy. Managed by the super admin.</summary>
public sealed class CreditPack
{
    private CreditPack() { }

    public CreditPack(string name, int credits, long priceMinor, string currency, int sortOrder, string? badge)
    {
        Id = Guid.NewGuid(); Name = name.Trim(); Credits = credits; PriceMinor = priceMinor;
        Currency = currency.Trim().ToUpperInvariant(); SortOrder = sortOrder; Badge = Text.OrNull(badge);
    }

    public Guid     Id         { get; private set; }
    public string   Name       { get; private set; } = null!;
    public int      Credits    { get; private set; }
    /// <summary>Price in the currency's smallest unit (cents, fils).</summary>
    public long     PriceMinor { get; private set; }
    public string   Currency   { get; private set; } = "USD";
    public bool     IsActive   { get; private set; } = true;
    public int      SortOrder  { get; private set; }
    public string?  Badge      { get; private set; }
    public bool     IsDeleted  { get; private set; }
    public DateTime CreatedAt  { get; private set; } = DateTime.UtcNow;

    public void Update(string name, int credits, long priceMinor, string currency, int sortOrder, string? badge, bool active)
    {
        Name = name.Trim(); Credits = credits; PriceMinor = priceMinor; Currency = currency.Trim().ToUpperInvariant();
        SortOrder = sortOrder; Badge = Text.OrNull(badge); IsActive = active;
    }

    public void Delete() { IsDeleted = true; IsActive = false; }
}

/// <summary>
/// The platform's knobs: what a credit buys, what a free trial grants, and the daily caps that stop
/// one workspace burning through the data provider's budget. One row, created on first read.
/// </summary>
public sealed class PlatformSettings
{
    private PlatformSettings() { }
    public static PlatformSettings CreateDefault() => new() { Id = Guid.NewGuid() };

    public Guid  Id { get; private set; }
    /// <summary>Master switch. Off = no search, reveal or send anywhere on the platform.</summary>
    public bool  Enabled { get; private set; } = true;
    /// <summary>Credits for revealing one prospect's contact details.</summary>
    public int   RevealCost { get; private set; } = 1;
    /// <summary>Extra credit when the reveal also finds a person-level or verified email.</summary>
    public int   VerifiedEmailBonus { get; private set; } = 1;
    /// <summary>One-time credits granted to a workspace the first time it opens Lead Generation.</summary>
    public int   TrialGrantCredits { get; private set; } = 25;
    /// <summary>Discovery searches a workspace may start per day.</summary>
    public int   DailySearchLimit { get; private set; } = 10;
    /// <summary>Businesses a workspace may discover per day, across all searches.</summary>
    public int   DailyDiscoveryLimit { get; private set; } = 1500;
    public int   MaxResultsPerSearch { get; private set; } = 300;
    public int   MaxRevealsPerRequest { get; private set; } = 50;
    /// <summary>Pool entries enriched more recently than this are reused without paying a provider again.</summary>
    public int   PoolFreshDays { get; private set; } = 90;
    /// <summary>A reveal whose email bounces within this many days is credited back.</summary>
    public int   BounceRefundDays { get; private set; } = 7;
    /// <summary>JSON array of ISO country codes searches are allowed in.</summary>
    public string AllowedCountries { get; private set; } = "[\"AE\"]";
    /// <summary>Cold email needs a sender identity and an address; workspaces without one cannot send.</summary>
    public bool  RequireSenderIdentity { get; private set; } = true;

    // Outreach abuse limits (applied per workspace, per day).
    public int   MaxMailboxesPerWorkspace { get; private set; } = 5;
    public int   MaxDailySendsPerMailbox { get; private set; } = 50;
    public int   MaxDailySendsPerWorkspace { get; private set; } = 250;
    /// <summary>Sending pauses automatically above these rates (percent × 100, so 300 = 3.00%).</summary>
    public int   BounceRatePauseBp { get; private set; } = 300;
    public int   ComplaintRatePauseBp { get; private set; } = 10;
    /// <summary>A workspace on a free trial may not send cold email until it has paid for something.</summary>
    public bool  BlockSendingOnTrial { get; private set; } = true;

    public DateTime? UpdatedAt { get; private set; }

    public void Update(bool enabled, int revealCost, int verifiedEmailBonus, int trialGrant, int dailySearchLimit,
        int dailyDiscoveryLimit, int maxResultsPerSearch, int maxRevealsPerRequest, int poolFreshDays,
        int bounceRefundDays, string allowedCountriesJson, bool requireSenderIdentity,
        int maxMailboxes, int maxDailyPerMailbox, int maxDailyPerWorkspace, int bounceBp, int complaintBp,
        bool blockOnTrial)
    {
        Enabled = enabled; RevealCost = revealCost; VerifiedEmailBonus = verifiedEmailBonus;
        TrialGrantCredits = trialGrant; DailySearchLimit = dailySearchLimit; DailyDiscoveryLimit = dailyDiscoveryLimit;
        MaxResultsPerSearch = maxResultsPerSearch; MaxRevealsPerRequest = maxRevealsPerRequest;
        PoolFreshDays = poolFreshDays; BounceRefundDays = bounceRefundDays; AllowedCountries = allowedCountriesJson;
        RequireSenderIdentity = requireSenderIdentity; MaxMailboxesPerWorkspace = maxMailboxes;
        MaxDailySendsPerMailbox = maxDailyPerMailbox; MaxDailySendsPerWorkspace = maxDailyPerWorkspace;
        BounceRatePauseBp = bounceBp; ComplaintRatePauseBp = complaintBp; BlockSendingOnTrial = blockOnTrial;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// The shared pool of public business data. Every discovery adds to it and every enrichment is
/// kept, so the next workspace to find the same business gets fresher data for less. Business
/// level only: a company name, address, switchboard phone, website and a generic email. No named
/// individuals are ever stored here — those are fetched on demand and kept in the workspace.
/// </summary>
public sealed class BusinessDirectoryEntry
{
    private BusinessDirectoryEntry() { }

    public BusinessDirectoryEntry(string placeId, string name, string countryCode)
    {
        Id = Guid.NewGuid(); GooglePlaceId = placeId; Name = name.Trim(); NameKey = Text.Key(name);
        CountryCode = countryCode.Trim().ToUpperInvariant();
    }

    public Guid      Id            { get; private set; }
    public string    GooglePlaceId { get; private set; } = null!;
    public string    Name          { get; private set; } = null!;
    public string    NameKey       { get; private set; } = string.Empty;
    public string?   Category      { get; private set; }
    public string?   PrimaryType   { get; private set; }
    public string    CountryCode   { get; private set; } = "AE";
    public string?   Region        { get; private set; }
    public string?   City          { get; private set; }
    public string?   Area          { get; private set; }
    public string?   Address       { get; private set; }
    public double?   Latitude      { get; private set; }
    public double?   Longitude     { get; private set; }
    public string?   Phone         { get; private set; }
    public string?   PhoneE164     { get; private set; }
    public string?   PhoneType     { get; private set; }
    public string?   Website       { get; private set; }
    public string?   Domain        { get; private set; }
    /// <summary>A role address from the company's own site (info@, sales@) — never a personal one.</summary>
    public string?   Email         { get; private set; }
    public string    EmailStatus   { get; private set; } = Entities.EmailStatus.Unknown;
    public bool      EmailIsRole   { get; private set; }
    public string?   Social        { get; private set; }
    public decimal?  Rating        { get; private set; }
    public int?      ReviewCount   { get; private set; }
    public string?   BusinessStatus { get; private set; }
    public string?   GoogleMapsUri { get; private set; }
    public DateTime  FirstSeenAt   { get; private set; } = DateTime.UtcNow;
    public DateTime  LastSeenAt    { get; private set; } = DateTime.UtcNow;
    /// <summary>Null until the website and email have been checked.</summary>
    public DateTime? EnrichedAt    { get; private set; }
    public int       TimesFound    { get; private set; } = 1;

    public bool IsClosed => BusinessStatus is "CLOSED_PERMANENTLY";

    public void Refresh(string name, string? category, string? primaryType, string? region, string? city, string? area,
        string? address, double? lat, double? lng, string? phone, string? phoneE164, string? phoneType,
        string? website, string? domain, decimal? rating, int? reviewCount, string? businessStatus, string? mapsUri)
    {
        Name = name.Trim(); NameKey = Text.Key(name);
        Category = Text.OrNull(category) ?? Category; PrimaryType = Text.OrNull(primaryType) ?? PrimaryType;
        Region = Text.OrNull(region) ?? Region; City = Text.OrNull(city) ?? City; Area = Text.OrNull(area) ?? Area;
        Address = Text.OrNull(address) ?? Address; Latitude = lat ?? Latitude; Longitude = lng ?? Longitude;
        Phone = Text.OrNull(phone) ?? Phone; PhoneE164 = Text.OrNull(phoneE164) ?? PhoneE164; PhoneType = Text.OrNull(phoneType) ?? PhoneType;
        if (!string.Equals(Website, website, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(website))
        { Website = website; Domain = domain; EnrichedAt = null; }   // a new site means the old email is suspect
        Rating = rating ?? Rating; ReviewCount = reviewCount ?? ReviewCount;
        BusinessStatus = Text.OrNull(businessStatus) ?? BusinessStatus; GoogleMapsUri = Text.OrNull(mapsUri) ?? GoogleMapsUri;
        LastSeenAt = DateTime.UtcNow; TimesFound++;
    }

    /// <summary>An address on this business turned out to be dead: forget it, so the next reveal looks again.</summary>
    public void InvalidateEmail() { Email = null; EmailStatus = Entities.EmailStatus.Unknown; EnrichedAt = null; }

    public void SetEnrichment(string? email, string emailStatus, bool isRole, string? social, string? phone,
        string? phoneE164, string? phoneType)
    {
        Email = Text.OrNull(email); EmailStatus = emailStatus; EmailIsRole = isRole; Social = social;
        if (!string.IsNullOrWhiteSpace(phoneE164)) { Phone = phone ?? Phone; PhoneE164 = phoneE164; PhoneType = phoneType; }
        EnrichedAt = DateTime.UtcNow;
    }
}

/// <summary>
/// Addresses and domains nobody on the platform may email — an unsubscribe or a complaint made to
/// one workspace protects the recipient from every workspace.
/// </summary>
public sealed class GlobalSuppression
{
    private GlobalSuppression() { }

    public GlobalSuppression(string kind, string value, string reason)
    {
        Id = Guid.NewGuid(); Kind = kind; Value = SuppressionEntry.Normalize(kind, value); Reason = reason;
    }

    public Guid     Id        { get; private set; }
    public string   Kind      { get; private set; } = SuppressionKind.Email;
    public string   Value     { get; private set; } = null!;
    public string   Reason    { get; private set; } = SuppressionReason.Manual;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
}
