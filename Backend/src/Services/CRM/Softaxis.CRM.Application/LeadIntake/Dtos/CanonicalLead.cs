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

    // ── Attribution / provenance ──────────────────────────────────────────────
    public string? ExternalLeadId { get; set; }
    public string? Campaign   { get; set; }
    public string? CampaignId { get; set; }
    public string? AdSetId    { get; set; }
    public string? AdId       { get; set; }
    public string? PageId     { get; set; }
    public string? FormId     { get; set; }
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

    public static readonly IReadOnlyList<string> All =
    [
        FirstName, LastName, FullName, Email, Phone, Company, Title, Industry, Address, City, Country, Notes
    ];
}
