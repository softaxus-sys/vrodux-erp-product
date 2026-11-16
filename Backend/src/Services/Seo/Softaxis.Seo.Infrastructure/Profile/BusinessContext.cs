using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Competitors;

namespace Softaxis.Seo.Infrastructure.Profile;

/// <summary>What the SEO module knows about the business behind a website, ready to hand to the AI and to the relevance filter.</summary>
public sealed record BusinessContext(
    string Name, string? Industry, string Summary, IReadOnlyList<string> Offers, string? Audience, string? ServiceAreas, IReadOnlyList<string> Avoid)
{
    /// <summary>
    /// The saved profile when it is complete. Sites set up before profiles existed may only have the older free-text "what is this site about"
    /// note; if that note is a real sentence it is accepted so those sites keep working, but the screen still asks for a proper profile.
    /// Null means there is nothing reliable to steer content with.
    /// </summary>
    public static BusinessContext? From(SeoBusinessProfile? profile, string? nicheHint, string siteName)
    {
        // An automatic draft is not trusted until a person has confirmed it.
        if (profile is { IsReady: true, IsDraft: false })
            return new BusinessContext(profile.BusinessName, Nullable(profile.Industry), profile.Summary, profile.Offers,
                Nullable(profile.Audience), Nullable(profile.ServiceAreas), profile.AvoidTopics);

        var hint = nicheHint?.Trim();
        return hint is { Length: >= SeoBusinessProfile.MinSummaryLength }
            ? new BusinessContext(siteName, null, hint, [], null, null, [])
            : null;
    }

    private static string? Nullable(string s) => string.IsNullOrWhiteSpace(s) ? null : s;
}

public enum Fit { Fits, Unclear, Avoid }

/// <summary>
/// Judges whether a search term or topic belongs to this business, from words alone (no network, no AI), so the rule is exact and testable.
/// "Fits" = it shares a meaningful word with what the business says it does or sells; "Avoid" = it is on the business's never-write-about list;
/// "Unclear" = neither — the AI judge, when available, decides those; without it they are left out rather than guessed in.
/// </summary>
public static class RelevanceFilter
{
    // Words that appear in almost every business description and so say nothing about what this one does.
    private static readonly HashSet<string> Generic = new(StringComparer.Ordinal)
    {
        "business","company","provide","provides","provider","offer","offers","solution","solutions","customer","customers","client","clients",
        "quality","professional","based","help","helps","team","experience","leading","local","wide","range","need","needs","want","make","makes",
        "like","also","well","using","use","including","include","includes","works","work","working","get","gets","across","together","trusted",
        "company","companies","store","shop","brand","brands","people","everyone","every","day","time","years","year","world","best",
    };

    public static string Stem(string word)
    {
        var w = word.ToLowerInvariant();
        if (w.Length > 5 && w.EndsWith("ies", StringComparison.Ordinal)) return w[..^3] + "y";
        if (w.Length > 4 && w.EndsWith("es", StringComparison.Ordinal) && (w.EndsWith("ches") || w.EndsWith("shes") || w.EndsWith("sses") || w.EndsWith("xes"))) return w[..^2];
        if (w.Length > 4 && w.EndsWith('s') && !w.EndsWith("ss", StringComparison.Ordinal)) return w[..^1];
        return w;
    }

    private static IEnumerable<string> Words(string? text) =>
        CompetitorAnalysis.Tokens(text).Where(t => t.Length > 0).Select(Stem);

    /// <summary>The meaningful words the business uses about itself. Where it works is deliberately left out: a city is context, not a topic.</summary>
    public static HashSet<string> Vocabulary(BusinessContext c)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var text in new[] { c.Summary, c.Industry, c.Audience }.Concat(c.Offers))
            foreach (var w in Words(text)) if (!Generic.Contains(w)) set.Add(w);
        // The description often names the city too ("families in Islamabad"); a place is where they work, not what they do.
        foreach (var w in Words(c.ServiceAreas)) set.Remove(w);
        return set;
    }

    /// <summary>The words a phrase shares with the business, for showing why it fits.</summary>
    public static IReadOnlyList<string> Matches(string phrase, HashSet<string> vocabulary) =>
        Words(phrase).Where(vocabulary.Contains).Distinct().ToList();

    public static Fit Classify(string phrase, BusinessContext c, HashSet<string>? vocabulary = null)
    {
        var words = Words(phrase).ToHashSet(StringComparer.Ordinal);
        foreach (var avoid in c.Avoid)
        {
            var a = Words(avoid).ToList();
            if (a.Count > 0 && a.All(words.Contains)) return Fit.Avoid;
        }
        vocabulary ??= Vocabulary(c);
        return words.Any(vocabulary.Contains) ? Fit.Fits : Fit.Unclear;
    }
}
