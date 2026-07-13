namespace Softaxis.CRM.Application.LeadIntake.Dtos;

/// <summary>
/// The one canonical lead shape every provider normalizes to. Providers fill the
/// strongly-typed fields they can, and may stash everything else in
/// <see cref="RawFields"/> so tenant <c>FieldMapping</c>s can promote extra fields
/// without any code change.
/// </summary>
public sealed class CanonicalLead
{
    public string? FirstName { get; set; }
    public string? LastName  { get; set; }
    /// <summary>Used when a provider only supplies a single full-name field.</summary>
    public string? FullName  { get; set; }
    public string? Email     { get; set; }
    public string? Phone     { get; set; }
    public string? Company   { get; set; }
    public string? Title     { get; set; }
    public string? Industry  { get; set; }
    public string? Address   { get; set; }
    public string? City      { get; set; }
    public string? Country   { get; set; }
    public string? Notes     { get; set; }

    // ── Requirements (lead-gen form questions) ────────────────────────────────
    public string? WhatsApp     { get; set; }
    public string? InterestedIn { get; set; }
    public string? Budget       { get; set; }
    public string? Message      { get; set; }
    /// <summary>Free-text "when are you planning to buy/invest?" answer (drives purchase urgency).</summary>
    public string? Timeframe    { get; set; }

    // ── Attribution / provenance ──────────────────────────────────────────────
    public string? ExternalLeadId { get; set; }
    public string? Platform   { get; set; }   // meta / facebook / instagram / google …
    public string? FormName   { get; set; }
    public bool?   IsOrganic  { get; set; }
    public string? Campaign   { get; set; }
    public string? CampaignId { get; set; }
    public string? AdSetId    { get; set; }
    public string? AdSetName  { get; set; }
    public string? AdId       { get; set; }
    public string? AdName     { get; set; }
    public string? PageId     { get; set; }
    public string? FormId     { get; set; }
    public string? PlatformCreatedTime { get; set; }
    public string? UtmSource   { get; set; }
    public string? UtmMedium   { get; set; }
    public string? UtmCampaign { get; set; }
    public string? UtmTerm     { get; set; }
    public string? UtmContent  { get; set; }

    /// <summary>Raw source field name → value, before tenant field-mapping is applied.</summary>
    public Dictionary<string, string?> RawFields { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>The original payload, kept for audit / replay.</summary>
    public string? RawJson { get; set; }
}

/// <summary>The canonical lead field keys a <c>FieldMapping.TargetField</c> may target.</summary>
public static class CanonicalLeadFields
{
    public const string FirstName = "firstName";
    public const string LastName  = "lastName";
    public const string FullName  = "fullName";
    public const string Email     = "email";
    public const string Phone     = "phone";
    public const string Company   = "company";
    public const string Title     = "title";
    public const string Industry  = "industry";
    public const string Address   = "address";
    public const string City      = "city";
    public const string Country   = "country";
    public const string Notes     = "notes";
    public const string WhatsApp     = "whatsApp";
    public const string InterestedIn = "interestedIn";
    public const string Budget       = "budget";
    public const string Message      = "message";
    public const string Timeframe    = "timeframe";
    public const string Campaign     = "campaign";
    public const string FormName     = "formName";

    public static readonly IReadOnlyList<string> All =
    [
        FirstName, LastName, FullName, Email, Phone, Company, Title, Industry, Address, City, Country, Notes,
        WhatsApp, InterestedIn, Budget, Message, Timeframe, Campaign, FormName
    ];
}
