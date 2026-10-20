namespace Softaxis.LeadGen.Domain.Entities;

/// <summary>
/// A business a workspace found. Until it is revealed it is a teaser — the API returns the name,
/// category, area and rating but never the phone, email or website, which are what the credit
/// buys. Revealing runs enrichment, then charges; a prospect with nothing usable is refunded.
/// </summary>
public sealed class Prospect
{
    private Prospect() { }

    public Prospect(Guid? searchJobId, string name, string countryCode)
    {
        Id          = Guid.NewGuid();
        SearchJobId = searchJobId;
        Name        = name.Trim();
        NameKey     = Text.Key(name);
        CountryCode = countryCode.Trim().ToUpperInvariant();
    }

    public Guid      Id           { get; private set; }
    public Guid?     SearchJobId  { get; private set; }
    public Guid?     DirectoryId  { get; private set; }

    public string    Name         { get; private set; } = null!;
    public string    NameKey      { get; private set; } = string.Empty;
    public string?   Category     { get; private set; }
    public string?   PrimaryType  { get; private set; }
    public string    CountryCode  { get; private set; } = "AE";
    public string?   Region       { get; private set; }
    public string?   City         { get; private set; }
    public string?   Area         { get; private set; }
    public string?   Address      { get; private set; }
    public double?   Latitude     { get; private set; }
    public double?   Longitude    { get; private set; }

    public string?   Phone        { get; private set; }
    public string?   PhoneE164    { get; private set; }
    /// <summary>mobile | landline | voip | unknown.</summary>
    public string?   PhoneType    { get; private set; }
    public string?   Website      { get; private set; }
    public string?   Domain       { get; private set; }
    public string?   Email        { get; private set; }
    public string    EmailStatus  { get; private set; } = Entities.EmailStatus.Unknown;
    /// <summary>info@, sales@, contact@ … reaches a desk, not a person, and replies far less.</summary>
    public bool      EmailIsRole  { get; private set; }
    /// <summary>JSON object of social profile links found on the website.</summary>
    public string?   Social       { get; private set; }

    public decimal?  Rating       { get; private set; }
    public int?      ReviewCount  { get; private set; }
    public string?   BusinessStatus { get; private set; }
    public string?   GoogleMapsUri  { get; private set; }
    public string?   GooglePlaceId  { get; private set; }

    public string    Status       { get; private set; } = ProspectStatus.Discovered;
    public bool      IsRevealed   { get; private set; }
    public DateTime? RevealedAt   { get; private set; }
    public Guid?     RevealedByUserId { get; private set; }
    public int       CreditsCharged   { get; private set; }

    /// <summary>0–100: how complete and how verified the contact data is.</summary>
    public int       QualityScore { get; private set; }
    /// <summary>0–100: how well it matches what the workspace sells.</summary>
    public int       FitScore     { get; private set; }
    /// <summary>JSON array of short reasons behind the two scores, shown to the user.</summary>
    public string?   ScoreNotes   { get; private set; }

    public Guid?     OwnerUserId  { get; private set; }
    public string?   OwnerName    { get; private set; }
    public Guid?     CrmLeadId    { get; private set; }
    public string?   Notes        { get; private set; }
    public DateTime? LastVerifiedAt { get; private set; }

    public DateTime  CreatedAt    { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt    { get; private set; }
    public bool      IsDeleted    { get; private set; }

    public List<ProspectContact> Contacts { get; private set; } = [];

    public void SetListing(Guid? directoryId, string? category, string? primaryType, string? region, string? city,
        string? area, string? address, double? lat, double? lng, string? phone, string? phoneE164, string? phoneType,
        string? website, string? domain, decimal? rating, int? reviewCount, string? businessStatus,
        string? mapsUri, string? placeId)
    {
        DirectoryId = directoryId; Category = Text.OrNull(category); PrimaryType = Text.OrNull(primaryType);
        Region = Text.OrNull(region); City = Text.OrNull(city); Area = Text.OrNull(area);
        Address = Text.OrNull(address); Latitude = lat; Longitude = lng;
        Phone = Text.OrNull(phone); PhoneE164 = Text.OrNull(phoneE164); PhoneType = Text.OrNull(phoneType);
        Website = Text.OrNull(website); Domain = Text.OrNull(domain);
        Rating = rating; ReviewCount = reviewCount; BusinessStatus = Text.OrNull(businessStatus);
        GoogleMapsUri = Text.OrNull(mapsUri); GooglePlaceId = Text.OrNull(placeId);
    }

    public void SetEnrichment(string? email, string emailStatus, bool emailIsRole, string? social,
        string? phone, string? phoneE164, string? phoneType, DateTime verifiedAt)
    {
        Email = Text.OrNull(email); EmailStatus = emailStatus; EmailIsRole = emailIsRole; Social = social;
        if (!string.IsNullOrWhiteSpace(phoneE164)) { Phone = phone ?? Phone; PhoneE164 = phoneE164; PhoneType = phoneType; }
        LastVerifiedAt = verifiedAt;
    }

    public void SetScores(int quality, int fit, string? notesJson)
    {
        QualityScore = Math.Clamp(quality, 0, 100); FitScore = Math.Clamp(fit, 0, 100); ScoreNotes = notesJson;
    }

    public void MarkRevealed(Guid? userId, int credits)
    {
        IsRevealed = true; RevealedAt = DateTime.UtcNow; RevealedByUserId = userId; CreditsCharged = credits;
        if (Status == ProspectStatus.Discovered) Status = ProspectStatus.Revealed;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RefundCredits() { CreditsCharged = 0; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Credits handed back after the reveal (a dead email) reduce what this prospect is recorded as costing.</summary>
    public void ReduceCharge(int amount) { CreditsCharged = Math.Max(0, CreditsCharged - amount); UpdatedAt = DateTime.UtcNow; }

    public void SetStatus(string status) { Status = status; UpdatedAt = DateTime.UtcNow; }

    public void Assign(Guid? userId, string? name) { OwnerUserId = userId; OwnerName = Text.OrNull(name); UpdatedAt = DateTime.UtcNow; }

    public void SetNotes(string? notes) { Notes = Text.OrNull(notes); UpdatedAt = DateTime.UtcNow; }

    public void LinkCrmLead(Guid? leadId)
    {
        CrmLeadId = leadId; UpdatedAt = DateTime.UtcNow;
        if (leadId is not null && Status is ProspectStatus.Revealed or ProspectStatus.Discovered) Status = ProspectStatus.Converted;
    }

    public void SetContactEmail(string email, string status, bool isRole)
    { Email = email; EmailStatus = status; EmailIsRole = isRole; UpdatedAt = DateTime.UtcNow; }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

/// <summary>A named person at a prospect, entered by hand or found on the company's own site.</summary>
public sealed class ProspectContact
{
    private ProspectContact() { }

    public ProspectContact(Guid prospectId, string fullName, string? title, string? email, string? phone, string source)
    {
        Id = Guid.NewGuid(); ProspectId = prospectId; FullName = fullName.Trim();
        Title = Text.OrNull(title); Email = Text.OrNull(email); Phone = Text.OrNull(phone); Source = source;
    }

    public Guid     Id          { get; private set; }
    public Guid     ProspectId  { get; private set; }
    public string   FullName    { get; private set; } = null!;
    public string?  Title       { get; private set; }
    public string?  Email       { get; private set; }
    public string   EmailStatus { get; private set; } = Entities.EmailStatus.Unknown;
    public string?  Phone       { get; private set; }
    /// <summary>manual | website.</summary>
    public string   Source      { get; private set; } = "manual";
    public DateTime CreatedAt   { get; private set; } = DateTime.UtcNow;
    public bool     IsDeleted   { get; private set; }

    public void SetEmailStatus(string status) => EmailStatus = status;
    public void Delete() => IsDeleted = true;
}
