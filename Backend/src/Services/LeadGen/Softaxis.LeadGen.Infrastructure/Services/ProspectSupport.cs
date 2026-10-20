using System.Text.Json;
using Softaxis.LeadGen.Application.Catalog;
using Softaxis.LeadGen.Application.Prospects;
using Softaxis.LeadGen.Application.Scoring;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Providers;

namespace Softaxis.LeadGen.Infrastructure.Services;

internal static class ProspectSupport
{
    public static ScoreProfile? ProfileFor(LeadGenProfile? p)
    {
        if (p is null) return null;
        var exclude = (p.ExcludeKeywords ?? "")
            .Split([',', '\n', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        return new ScoreProfile(ProspectScoring.ParseList(p.PreferredCategories), ProspectScoring.ParseList(p.PreferredRegions), exclude);
    }

    public static ScoreResult ScoreOf(Prospect p, ScoreProfile? profile) =>
        ProspectScoring.Score(new ScoreInput(
            p.PhoneE164, p.PhoneType, p.Website, WebsiteChecked: p.LastVerifiedAt is not null, p.Email, p.EmailStatus,
            p.EmailIsRole, HasSocial: !string.IsNullOrWhiteSpace(p.Social), p.BusinessStatus, p.Rating, p.ReviewCount,
            p.Address, p.Category, CategoryKeyOf(p), p.Region, p.Name), profile);

    /// <summary>The category key, when the stored category is one of ours (manual prospects may carry free text).</summary>
    public static string? CategoryKeyOf(Prospect p) => CategoryCatalog.IsValid(p.Category) ? p.Category : null;

    public static string? LabelOf(string? category) =>
        category is null ? null : CategoryCatalog.Get(category)?.Label ?? category;

    public static string? DomainOf(string? website) =>
        SafeHttp.ParseWebsite(website) is { } u ? SafeHttp.Domain(u) : null;

    public static IReadOnlyDictionary<string, string>? SocialOf(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(json); } catch { return null; }
    }

    /// <summary>
    /// Builds the API shape of a prospect. Contact details are included ONLY when it has been revealed
    /// (or was entered by hand) — this is the one place that decides, so no query path can leak them.
    /// </summary>
    public static ProspectDto ToDto(Prospect p, bool suppressed, IReadOnlyList<ContactDto>? contacts = null)
    {
        var open = p.IsRevealed;
        return new ProspectDto(
            p.Id, p.SearchJobId, p.Name, p.Category, LabelOf(p.Category), p.CountryCode, p.Region, p.City, p.Area,
            p.Address, p.Rating, p.ReviewCount, p.BusinessStatus, p.GoogleMapsUri,
            p.IsRevealed, p.Status, p.QualityScore, p.FitScore, ProspectScoring.ParseList(p.ScoreNotes),
            HasPhone: !string.IsNullOrWhiteSpace(p.PhoneE164), HasWebsite: !string.IsNullOrWhiteSpace(p.Website),
            HasEmail: open ? !string.IsNullOrWhiteSpace(p.Email) : null,
            open ? p.Phone : null, open ? p.PhoneType : null, open ? p.Website : null, open ? p.Email : null,
            open ? p.EmailStatus : EmailStatus.Unknown, open && p.EmailIsRole,
            open ? SocialOf(p.Social) : null,
            p.OwnerUserId, p.OwnerName, p.CrmLeadId, p.Notes, suppressed, p.RevealedAt, p.LastVerifiedAt, p.CreatedAt,
            open ? contacts : null);
    }

    public static ContactDto ToDto(ProspectContact c) =>
        new(c.Id, c.FullName, c.Title, c.Email, c.EmailStatus, c.Phone, c.Source);
}
