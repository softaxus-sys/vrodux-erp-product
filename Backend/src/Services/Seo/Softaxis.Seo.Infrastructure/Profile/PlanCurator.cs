using System.Globalization;
using System.Text.Json;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.Seo.Infrastructure.Competitors;

namespace Softaxis.Seo.Infrastructure.Profile;

public sealed record JudgedSlot(bool Fits, string? Title, string? Summary, string? FitReason);

public sealed record CuratedSlot(PlanSlot Slot, string Summary, string FitReason);

/// <param name="Dropped">Candidates left out because they do not suit the business.</param>
public sealed record CuratedPlan(IReadOnlyList<CuratedSlot> Kept, int Dropped, bool UsedAi);

/// <summary>
/// Turns the raw "what competitors have that you do not" candidates into a plan that belongs to this business: unrelated and
/// never-write-about ideas are removed, and every survivor gets a plain headline, a one-sentence description of what the article covers, and the
/// reason it suits the business — so a person can tell at a glance whether to write it or ignore it. Pure; the AI's verdicts are passed in.
/// </summary>
public static class PlanCurator
{
    public const int MaxTitle = 80;

    public static CuratedPlan Curate(BusinessContext ctx, IReadOnlyList<PlanSlot> candidates, IReadOnlyDictionary<int, JudgedSlot>? judgments, DateOnly today, int max = 15)
    {
        var vocab = RelevanceFilter.Vocabulary(ctx);
        var kept = new List<CuratedSlot>();
        var dropped = 0;

        for (var i = 0; i < candidates.Count; i++)
        {
            var slot = candidates[i];
            var fit = RelevanceFilter.Classify(slot.TargetKeyword, ctx, vocab);
            if (fit == Fit.Avoid) { dropped++; continue; }

            JudgedSlot? judged = null;
            judgments?.TryGetValue(i, out judged);

            if (judged is not null)
            {
                if (!judged.Fits) { dropped++; continue; }
            }
            else if (fit != Fit.Fits) { dropped++; continue; }   // no AI verdict: only what plainly matches the profile gets in

            if (kept.Count >= max) continue;

            var title = judged?.Title is { Length: > 0 } t ? Tidy(t) : slot.Title;
            var summary = judged?.Summary is { Length: > 0 } s ? s.Trim() : FallbackSummary(slot);
            var why = judged?.FitReason is { Length: > 0 } r ? r.Trim() : FallbackFit(slot, vocab);
            var date = today.AddDays(1 + kept.Count * 2).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            kept.Add(new CuratedSlot(slot with { PlannedDate = date, Title = title }, summary, why));
        }

        return new CuratedPlan(kept, dropped, judgments is not null);
    }

    private static string Tidy(string title)
    {
        var t = title.Trim().Trim('"', '“', '”');
        return t.Length > MaxTitle ? t[..MaxTitle].TrimEnd() : t;
    }

    private static string FallbackSummary(PlanSlot slot) =>
        slot.Source == "keyword"
            ? $"An article for people searching “{slot.TargetKeyword}”, a search your competitors already get visitors from."
            : $"An article on “{slot.TargetKeyword}”, a subject several competitors publish about.";

    private static string FallbackFit(PlanSlot slot, HashSet<string> vocab)
    {
        var shared = RelevanceFilter.Matches(slot.TargetKeyword, vocab);
        return shared.Count > 0
            ? $"Matches what your profile says you do: {string.Join(", ", shared.Take(3))}."
            : "Related to your business profile.";
    }
}

/// <summary>Asks the workspace's own AI whether each idea suits the business, and for a clear headline and description for the ones that do.</summary>
public interface IPlanEditor
{
    /// <summary>Verdicts by candidate index, or null when no AI is available or it failed (the caller then falls back to the word-match filter).</summary>
    Task<IReadOnlyDictionary<int, JudgedSlot>?> JudgeAsync(BusinessContext ctx, IReadOnlyList<PlanSlot> candidates, CancellationToken ct);
}

public sealed class PlanEditor(IAiCompletionService completion) : IPlanEditor
{
    private const string System = """
        You are an SEO editor for ONE specific business. You are given what the business does and a numbered list of content ideas that were found
        by looking at competitors' websites. Competitors are often bigger or broader than this business, so many ideas will not suit it.

        For EVERY idea decide: does a real customer of THIS business, searching this, want what THIS business sells? Answer "off" when the idea is
        about a different kind of business, product or customer, is a competitor's brand, is too generic to attract this business's customers, or
        is on the business's avoid list. Answer "fit" only when the business could genuinely write a useful article that leads to its own offering.
        When unsure, answer "off".

        For each "fit" idea also write:
          - title: a specific, readable article headline, 70 characters or fewer, that says plainly what the article is about. Never just the
            keyword, and never filler like "A Practical Guide".
          - summary: one sentence (under 180 characters) saying what the article covers and what the reader learns, so an editor can decide to write it.
          - fitReason: one short sentence (under 140 characters) on why it suits this business.
        Do not invent facts about the business beyond what you are given.

        Respond with ONLY a JSON array, no prose, no markdown fences, one element per idea:
        { "id": <the idea's number>, "verdict": "fit" | "off", "title": "...", "summary": "...", "fitReason": "..." }
        """;

    public async Task<IReadOnlyDictionary<int, JudgedSlot>?> JudgeAsync(BusinessContext ctx, IReadOnlyList<PlanSlot> candidates, CancellationToken ct)
    {
        if (candidates.Count == 0) return new Dictionary<int, JudgedSlot>();

        var user = JsonSerializer.Serialize(new
        {
            business = new { name = ctx.Name, industry = ctx.Industry, whatItDoes = ctx.Summary, offers = ctx.Offers, customers = ctx.Audience, works = ctx.ServiceAreas, neverWriteAbout = ctx.Avoid },
            ideas = candidates.Select((c, i) => new
            {
                id = i, searchTerm = c.TargetKeyword, monthlySearches = c.Volume, why = c.Reason, source = c.Source,
            }),
        });

        string raw;
        try { raw = await completion.CompleteAsync(System, user, ct); }
        catch { return null; }   // AI not configured or the call failed — the word-match filter takes over

        return Parse(raw, candidates.Count);
    }

    public static IReadOnlyDictionary<int, JudgedSlot>? Parse(string raw, int count)
    {
        try
        {
            var s = raw.Trim();
            var start = s.IndexOf('['); var end = s.LastIndexOf(']');
            if (start < 0 || end <= start) return null;
            using var doc = JsonDocument.Parse(s[start..(end + 1)]);

            var result = new Dictionary<int, JudgedSlot>();
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                if (!el.TryGetProperty("id", out var idEl) || !idEl.TryGetInt32(out var id) || id < 0 || id >= count) continue;
                var verdict = el.TryGetProperty("verdict", out var v) ? v.GetString() : null;
                string? Str(string name) => el.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
                result[id] = new JudgedSlot(string.Equals(verdict, "fit", StringComparison.OrdinalIgnoreCase), Str("title"), Str("summary"), Str("fitReason"));
            }
            return result.Count == 0 ? null : result;
        }
        catch { return null; }
    }
}
