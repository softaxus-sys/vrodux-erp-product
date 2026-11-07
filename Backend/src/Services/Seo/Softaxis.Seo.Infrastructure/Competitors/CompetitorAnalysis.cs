using System.Globalization;
using System.Text.RegularExpressions;
using Softaxis.Seo.Application.Competitors;

namespace Softaxis.Seo.Infrastructure.Competitors;

/// <summary>What one page says about itself — all the topic comparison needs.</summary>
public sealed record PageText(string Url, string? Title, string? H1);

public sealed record PlanSlot(string PlannedDate, string Title, string TargetKeyword, string Reason, int? Volume, int? Difficulty, string Source);

/// <summary>
/// The comparison itself, free of any network or database so it can be tested exactly. Two views of the same question — "what do they
/// cover that we do not?":
/// topics (from the pages competitors actually publish; needs no paid data) and keywords (from search volumes; needs the keyword provider).
/// </summary>
public static class CompetitorAnalysis
{
    public const int MinCompetitorPagesForTopic = 2;
    public const int MinVolume = 20;
    public const int MaxCompetitorPosition = 20;
    public const int MaxTopicGaps = 40;
    public const int MaxKeywordGaps = 100;

    private static readonly Regex Words = new("[a-z0-9]+", RegexOptions.Compiled);

    private static readonly HashSet<string> Stop = new(StringComparer.Ordinal)
    {
        "a","an","the","and","or","of","to","in","on","at","for","with","from","by","is","are","was","were","be","been","it","its","this","that",
        "these","those","as","your","you","our","we","us","my","me","how","what","why","when","where","who","which","can","do","does","will",
        "not","no","yes","all","any","more","most","best","top","new","get","buy","now","here","there","about","contact","home","page","pages",
        "blog","news","welcome","official","site","website","online","login","log","sign","signup","cart","checkout","account","privacy","policy",
        "terms","conditions","faq","faqs","services","service","products","product","category","categories","tag","archive","archives","read",
        "view","click","free","one","two","three","also","into","out","up","off","than","then","just","very","per","vs","com","www","http","https",
    };

    // ── Topics ────────────────────────────────────────────────────────────────

    /// <summary>The words of a title/heading with filler removed, in order.</summary>
    public static List<string> Tokens(string? text)
    {
        var list = new List<string>();
        if (string.IsNullOrWhiteSpace(text)) return list;
        foreach (Match m in Words.Matches(text.ToLowerInvariant()))
        {
            var w = m.Value;
            if (w.Length < 3 || Stop.Contains(w) || w.All(char.IsDigit)) { list.Add(""); continue; } // "" marks a break so phrases do not span filler
            list.Add(w);
        }
        return list;
    }

    private static IEnumerable<(string A, string B)> Bigrams(List<string> tokens)
    {
        for (var i = 0; i + 1 < tokens.Count; i++)
            if (tokens[i].Length > 0 && tokens[i + 1].Length > 0 && tokens[i] != tokens[i + 1]) yield return (tokens[i], tokens[i + 1]);
    }

    /// <summary>Words of a domain's own name ("acme-widgets.com" → acme, widgets) so a competitor's brand is not mistaken for a topic.</summary>
    public static HashSet<string> BrandTokens(string domain)
    {
        var host = domain.Split('/')[0];
        var dot = host.LastIndexOf('.');
        var label = dot > 0 ? host[..dot] : host;
        return Words.Matches(label.ToLowerInvariant()).Select(m => m.Value).Where(w => w.Length >= 3).ToHashSet();
    }

    public static List<TopicGapDto> TopicGaps(IReadOnlyList<PageText> own, IReadOnlyDictionary<string, IReadOnlyList<PageText>> competitors)
    {
        // Everything the site already mentions, as single words (generous on purpose: a gap must be genuinely absent).
        var ownWords = new HashSet<string>(StringComparer.Ordinal);
        foreach (var p in own)
            foreach (var t in Tokens(p.Title).Concat(Tokens(p.H1)).Concat(Tokens(UrlWords(p.Url)))) if (t.Length > 0) ownWords.Add(t);

        var found = new Dictionary<string, (int Pages, HashSet<string> Sites, string Title, string Url)>(StringComparer.Ordinal);
        foreach (var (domain, pages) in competitors)
        {
            var brand = BrandTokens(domain);
            foreach (var page in pages)
            {
                var seenOnPage = new HashSet<string>(StringComparer.Ordinal);
                foreach (var (a, b) in Bigrams(Tokens(page.Title)).Concat(Bigrams(Tokens(page.H1))))
                {
                    if (brand.Contains(a) || brand.Contains(b)) continue;
                    if (ownWords.Contains(a) && ownWords.Contains(b)) continue;
                    var phrase = $"{a} {b}";
                    if (!seenOnPage.Add(phrase)) continue;
                    found.TryGetValue(phrase, out var cur);
                    cur.Pages++;
                    (cur.Sites ??= new HashSet<string>(StringComparer.Ordinal)).Add(domain);
                    if (cur.Url is null) { cur.Title = page.Title ?? page.H1 ?? phrase; cur.Url = page.Url; }
                    found[phrase] = cur;
                }
            }
        }

        return found
            .Where(kv => kv.Value.Pages >= MinCompetitorPagesForTopic)
            .OrderByDescending(kv => kv.Value.Sites.Count).ThenByDescending(kv => kv.Value.Pages).ThenBy(kv => kv.Key, StringComparer.Ordinal)
            .Take(MaxTopicGaps)
            .Select(kv => new TopicGapDto(kv.Key, kv.Value.Pages, kv.Value.Sites.Count, kv.Value.Title, kv.Value.Url))
            .ToList();
    }

    private static string UrlWords(string url)
    {
        try { return Uri.TryCreate(url, UriKind.Absolute, out var u) ? u.AbsolutePath.Replace('-', ' ').Replace('_', ' ').Replace('/', ' ') : ""; }
        catch { return ""; }
    }

    // ── Keywords ──────────────────────────────────────────────────────────────

    public static List<KeywordGapDto> KeywordGaps(IReadOnlyList<KeywordRow> own, IReadOnlyDictionary<string, IReadOnlyList<KeywordRow>> competitors)
    {
        var ownKeywords = own.Select(k => k.Keyword).ToHashSet(StringComparer.Ordinal);
        var best = new Dictionary<string, (KeywordRow Row, string Domain, HashSet<string> Sites)>(StringComparer.Ordinal);

        foreach (var (domain, rows) in competitors)
        {
            var brand = BrandTokens(domain);
            foreach (var r in rows)
            {
                if (r.Position is < 1 or > MaxCompetitorPosition || r.Volume < MinVolume) continue;
                if (ownKeywords.Contains(r.Keyword)) continue;
                if (Tokens(r.Keyword).Any(t => t.Length > 0 && brand.Contains(t))) continue;   // their brand name, not a topic

                if (!best.TryGetValue(r.Keyword, out var cur)) best[r.Keyword] = (r, domain, new HashSet<string>(StringComparer.Ordinal) { domain });
                else
                {
                    cur.Sites.Add(domain);
                    best[r.Keyword] = r.Position < cur.Row.Position ? (r, domain, cur.Sites) : cur;
                }
            }
        }

        return best.Values
            .Select(v => (v, Score: Score(v.Row, v.Sites.Count)))
            .OrderByDescending(x => x.Score).ThenBy(x => x.v.Row.Keyword, StringComparer.Ordinal)
            .Take(MaxKeywordGaps)
            .Select(x => new KeywordGapDto(x.v.Row.Keyword, x.v.Row.Volume, x.v.Row.Difficulty, x.v.Domain, x.v.Row.Position, x.v.Sites.Count))
            .ToList();
    }

    /// <summary>Bigger demand, several competitors agreeing, and an easier fight all rank higher.</summary>
    public static double Score(KeywordRow row, int competitorCount) =>
        row.Volume * (1 + 0.5 * (competitorCount - 1)) * (1 - Math.Clamp(row.Difficulty ?? 50, 0, 100) / 150.0);

    // ── The 30-day plan ───────────────────────────────────────────────────────

    /// <summary>One piece every two days for 30 days (15 slots), search terms first, then topics. No two slots cover the same ground.</summary>
    public static List<PlanSlot> BuildPlan(IReadOnlyList<KeywordGapDto> keywords, IReadOnlyList<TopicGapDto> topics, DateOnly today, int slots = 15)
    {
        var plan = new List<PlanSlot>();
        var covered = new List<HashSet<string>>();

        bool Overlaps(string phrase)
        {
            var t = Tokens(phrase).Where(x => x.Length > 0).ToHashSet();
            if (t.Count == 0) return true;
            return covered.Any(c => t.IsSubsetOf(c) || c.IsSubsetOf(t));
        }

        void Add(string keyword, string reason, int? volume, int? difficulty, string source)
        {
            if (plan.Count >= slots || Overlaps(keyword)) return;
            covered.Add(Tokens(keyword).Where(x => x.Length > 0).ToHashSet());
            var date = today.AddDays(1 + plan.Count * 2).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            plan.Add(new PlanSlot(date, TitleFor(keyword), keyword, reason, volume, difficulty, source));
        }

        // Search terms lead, but leave room for topics so the calendar is not one kind of piece.
        var keywordSlots = topics.Count == 0 ? slots : Math.Max(slots - Math.Min(topics.Count, 5), slots / 2);
        foreach (var k in keywords)
        {
            if (plan.Count >= keywordSlots) break;
            var who = k.CompetitorCount > 1 ? $"{k.CompetitorCount} competitors rank for this (best: {k.Competitor} at #{k.Position})" : $"{k.Competitor} ranks #{k.Position} for this";
            Add(k.Keyword, $"{who}; about {k.Volume:N0} searches a month and your site does not appear for it.", k.Volume, k.Difficulty, "keyword");
        }
        foreach (var t in topics)
            Add(t.Phrase, $"{t.Competitors} competitor site(s) publish {t.Pages} page(s) on this and your site has nothing on it (for example “{t.ExampleTitle}”).", null, null, "topic");
        // Keywords left over fill any remaining slots.
        foreach (var k in keywords)
            Add(k.Keyword, $"{k.Competitor} ranks #{k.Position} for this; about {k.Volume:N0} searches a month.", k.Volume, k.Difficulty, "keyword");

        return plan.OrderBy(p => p.PlannedDate, StringComparer.Ordinal).ToList();
    }

    public static string TitleFor(string keyword)
    {
        var title = CultureInfo.InvariantCulture.TextInfo.ToTitleCase(keyword.Trim());
        var first = keyword.TrimStart().Split(' ')[0];
        return first is "how" or "what" or "why" or "best" or "top" or "when" or "which" ? title : $"{title}: A Practical Guide";
    }
}
