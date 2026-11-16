using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Competitors;
using Softaxis.Seo.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Softaxis.Seo.Infrastructure.Profile;

public static class CompetitorSuggestions
{
    public const int MinSharedKeywords = 3;
    public const int MaxSuggestions = 8;

    // Sites that rank for everything but are never a business to compete with: networks, marketplaces, directories, reference and news sites.
    private static readonly string[] NotACompetitor =
    [
        "google.", "youtube.", "facebook.", "instagram.", "linkedin.", "twitter.", "x.com", "tiktok.", "pinterest.", "reddit.", "quora.", "wikipedia.",
        "wikihow.", "amazon.", "ebay.", "alibaba.", "aliexpress.", "olx.", "noon.com", "yelp.", "tripadvisor.", "indeed.", "glassdoor.", "medium.",
        "github.", "apple.com", "microsoft.com", "forbes.", "bloomberg.", "bbc.", "cnn.", "healthline.", "webmd.", "mayoclinic.", "nih.gov",
        "yellowpages.", "trustpilot.", "booking.com", "expedia.", "zillow.", "walmart.", "etsy.",
    ];

    public static bool IsNotACompetitor(string domain) =>
        NotACompetitor.Any(p => domain.Contains(p, StringComparison.OrdinalIgnoreCase)) || domain.EndsWith(".gov", StringComparison.OrdinalIgnoreCase)
        || domain.Contains(".gov.", StringComparison.OrdinalIgnoreCase) || domain.EndsWith(".edu", StringComparison.OrdinalIgnoreCase);

    /// <summary>The websites worth offering: not the site itself, not already on the list, not a network or directory, and overlapping enough to matter.</summary>
    public static List<CompetitorDomainRow> Filter(IEnumerable<CompetitorDomainRow> rows, string ownDomain, IReadOnlyCollection<string> existing)
    {
        var own = SeoCompetitor.Normalize(ownDomain);
        var have = existing.Select(SeoCompetitor.Normalize).ToHashSet(StringComparer.Ordinal);
        return rows
            .Select(r => r with { Domain = SeoCompetitor.Normalize(r.Domain) })
            .Where(r => r.Domain.Contains('.') && r.Domain != own && !have.Contains(r.Domain) && !r.Domain.EndsWith("." + own, StringComparison.Ordinal))
            .Where(r => r.SharedKeywords >= MinSharedKeywords && !IsNotACompetitor(r.Domain))
            .GroupBy(r => r.Domain).Select(g => g.First())
            .OrderByDescending(r => r.SharedKeywords).Take(MaxSuggestions).ToList();
    }
}

internal static class BusinessContextLoader
{
    public const string NeededMessage =
        "Add your business profile first (Business profile tab). Suggestions and articles are judged against what your business does, so they stay relevant.";

    /// <summary>The saved profile, or — for sites that only have the older "what is this site about" note — that note. Null if neither is usable.</summary>
    public static async Task<BusinessContext?> LoadAsync(SeoDbContext db, SeoSite site, CancellationToken ct)
    {
        var profile = await db.BusinessProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.SiteId == site.Id, ct);
        var hint = await db.ContentSettings.AsNoTracking().Where(s => s.SiteId == site.Id).Select(s => s.NicheHint).FirstOrDefaultAsync(ct);
        return BusinessContext.From(profile, hint, site.DisplayName);
    }
}
