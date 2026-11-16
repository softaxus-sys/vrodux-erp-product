using System.Text.Json;

namespace Softaxis.Seo.Domain.Entities;

public static class ProfileSources
{
    public const string Manual = "manual", Tenant = "tenant", Website = "website";
}

public static class AutofillStatuses
{
    public const string None = "none", Pending = "pending", Done = "done", Failed = "failed";
}

/// <summary>
/// What a website's business actually is and sells. Every suggestion the SEO module makes (competitor plans, scheduled articles) is judged
/// against this, so content stays about the business instead of about whatever a competitor happens to publish. One per site.
/// Filled by hand, imported from the workspace's own company details, or drafted from the site's own pages and then reviewed.
/// </summary>
public sealed class SeoBusinessProfile
{
    public const int MinSummaryLength = 20;
    public const int MaxOffers = 15;
    public const int MaxAvoid = 20;

    private SeoBusinessProfile() { }

    public SeoBusinessProfile(Guid siteId)
    {
        Id = Guid.NewGuid(); SiteId = siteId; CreatedAt = DateTime.UtcNow;
    }

    /// <summary>A profile created for a site that is still being read (no text yet).</summary>
    public static SeoBusinessProfile CreatePending(Guid siteId, string siteName)
    {
        var p = new SeoBusinessProfile(siteId) { BusinessName = Cut(siteName, 200), AutofillStatus = AutofillStatuses.Pending, IsDraft = true };
        return p;
    }

    public Guid      Id                   { get; private set; }
    public Guid      SiteId               { get; private set; }
    /// <summary>Filled in automatically and not yet confirmed by a person. A draft never steers content.</summary>
    public bool      IsDraft              { get; private set; }
    public string    AutofillStatus       { get; private set; } = AutofillStatuses.None;
    public string?   AutofillNote         { get; private set; }
    public string    BusinessName         { get; private set; } = string.Empty;
    public string    Industry             { get; private set; } = string.Empty;
    /// <summary>What the business does, in a few plain sentences.</summary>
    public string    Summary              { get; private set; } = string.Empty;
    /// <summary>The products or services it sells (JSON array of short phrases).</summary>
    public string    OffersJson           { get; private set; } = "[]";
    public string    Audience             { get; private set; } = string.Empty;
    /// <summary>Where it works — a country, city or "worldwide". Used as context only, never as a topic.</summary>
    public string    ServiceAreas         { get; private set; } = string.Empty;
    /// <summary>Subjects content must never be about (JSON array).</summary>
    public string    AvoidTopicsJson      { get; private set; } = "[]";
    public string    Source               { get; private set; } = ProfileSources.Manual;
    public DateTime? ImportedFromTenantAt { get; private set; }
    public DateTime  CreatedAt            { get; private set; }
    public DateTime? UpdatedAt            { get; private set; }

    public IReadOnlyList<string> Offers => ReadList(OffersJson);
    public IReadOnlyList<string> AvoidTopics => ReadList(AvoidTopicsJson);

    /// <summary>Enough to steer content: a real description, plus either what is sold or what industry it is in.</summary>
    public bool IsReady => IsReadyFor(Summary, Offers, Industry);

    public static bool IsReadyFor(string? summary, IReadOnlyCollection<string> offers, string? industry) =>
        (summary?.Trim().Length ?? 0) >= MinSummaryLength && (offers.Count > 0 || !string.IsNullOrWhiteSpace(industry));

    /// <summary>A person saved this: it is confirmed and from now on steers content.</summary>
    public void Update(string businessName, string? industry, string summary, IEnumerable<string>? offers, string? audience,
        string? serviceAreas, IEnumerable<string>? avoidTopics, string source)
    {
        Set(businessName, industry, summary, offers, audience, serviceAreas, avoidTopics, source);
        IsDraft = false;
        if (AutofillStatus == AutofillStatuses.Pending) AutofillStatus = AutofillStatuses.None;
    }

    /// <summary>Filled in automatically. Kept as a draft until a person confirms it. Never touches the never-write-about list.</summary>
    public void ApplyAutofill(string businessName, string? industry, string summary, IEnumerable<string>? offers, string? audience,
        string? serviceAreas, string source, string? note)
    {
        Set(businessName, industry, summary, offers, audience, serviceAreas, AvoidTopics, source);
        IsDraft = true; AutofillStatus = AutofillStatuses.Done; AutofillNote = note is { Length: > 300 } ? note[..300] : note;
    }

    public void RequestAutofill() { AutofillStatus = AutofillStatuses.Pending; AutofillNote = null; UpdatedAt = DateTime.UtcNow; }

    public void FailAutofill(string note)
    {
        AutofillStatus = AutofillStatuses.Failed; AutofillNote = note.Length > 300 ? note[..300] : note; UpdatedAt = DateTime.UtcNow;
    }

    private void Set(string businessName, string? industry, string summary, IEnumerable<string>? offers, string? audience,
        string? serviceAreas, IEnumerable<string>? avoidTopics, string source)
    {
        BusinessName = Cut(businessName, 200);
        Industry = Cut(industry, 120);
        Summary = Cut(summary, 1500);
        OffersJson = JsonSerializer.Serialize(Clean(offers, MaxOffers, 120));
        Audience = Cut(audience, 500);
        ServiceAreas = Cut(serviceAreas, 300);
        AvoidTopicsJson = JsonSerializer.Serialize(Clean(avoidTopics, MaxAvoid, 120));
        Source = source;
        if (source == ProfileSources.Tenant) ImportedFromTenantAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public static List<string> Clean(IEnumerable<string>? items, int max, int maxLen) =>
        (items ?? []).Select(i => Cut(i, maxLen)).Where(i => i.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase).Take(max).ToList();

    private static string Cut(string? s, int max)
    {
        var t = (s ?? "").Trim();
        return t.Length > max ? t[..max].TrimEnd() : t;
    }

    private static IReadOnlyList<string> ReadList(string json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? []; } catch { return []; }
    }
}
