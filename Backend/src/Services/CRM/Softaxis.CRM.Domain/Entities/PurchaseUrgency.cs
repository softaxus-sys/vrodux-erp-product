using System.Text.RegularExpressions;

namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// Classifies a free-text "when are you planning to buy / invest?" answer into a ranked
/// purchase-urgency bucket, and scores it. Dynamic keyword + number matching — arbitrary
/// phrasings ("ASAP", "in 2-3 months", "within 30 days", "just researching", "next year")
/// map to a bucket without a fixed enum on the input side. New phrasings = add a keyword.
///
/// Score contribution (max 25 — the strongest single buying signal):
///   Immediate 25 · Within 1 month 20 · 1–3 months 13 · 3–6 months 7 · 6+/researching 3 · unknown 0.
/// The bucket key is surfaced to the UI (URGENCY_META) for the urgency badge.
/// </summary>
public static class PurchaseUrgency
{
    public const string Immediate  = "immediate";
    public const string OneMonth   = "1_month";
    public const string OneToThree = "1_3_months";
    public const string ThreeToSix = "3_6_months";
    public const string SixPlus    = "6_plus";
    public const string Unknown    = "unknown";

    public static string Classify(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Unknown;
        var t = raw.Trim().ToLowerInvariant();

        // "Not now / just researching" beats any stray number in the text.
        if (ContainsAny(t, "just looking", "just browsing", "browsing", "researching", "research",
                "exploring", "not sure", "no timeline", "no time frame", "no rush", "no plan",
                "not planning", "someday", "near future", "in future"))
            return SixPlus;

        // Immediate intent.
        if (ContainsAny(t, "immediate", "immediatly", "asap", "as soon as possible", "right now",
                "right away", "ready to buy", "ready to move", "ready to invest", "this week",
                "urgent", "instantly", "buy now"))
            return Immediate;

        if (t.Contains("week")) return Immediate;

        // Day-based windows.
        var day = FirstNumberBefore(t, "day");
        if (day is int d)
            return d <= 7 ? Immediate : d <= 31 ? OneMonth : d <= 90 ? OneToThree : d <= 180 ? ThreeToSix : SixPlus;

        if (t.Contains("quarter")) return OneToThree;

        // Month-based → largest month number mentioned (handles ranges like "3-6 months").
        if (t.Contains("month"))
        {
            var months = LargestNumber(t);
            var openEnded = t.Contains("+") || ContainsAny(t, "more than", "over", "beyond", "at least");
            if (months is int m)
            {
                if (openEnded && m >= 6) return SixPlus; // "6+ months", "more than 6 months"
                return m <= 1 ? OneMonth : m <= 3 ? OneToThree : m <= 6 ? ThreeToSix : SixPlus;
            }
            return OneMonth; // "this month" / "within a month" with no number
        }

        if (t.Contains("year") || t.Contains("annum")) return SixPlus;

        return Unknown;
    }

    public static int Score(string? raw) => Classify(raw) switch
    {
        Immediate  => 25,
        OneMonth   => 20,
        OneToThree => 13,
        ThreeToSix => 7,
        SixPlus    => 3,
        _          => 0,
    };

    /// <summary>Friendly label for a bucket key (null for unknown → no badge).</summary>
    public static string? Label(string? bucket) => bucket switch
    {
        Immediate  => "Immediate",
        OneMonth   => "Within 1 month",
        OneToThree => "1–3 months",
        ThreeToSix => "3–6 months",
        SixPlus    => "6+ months",
        _          => null,
    };

    private static bool ContainsAny(string t, params string[] needles)
    {
        foreach (var n in needles) if (t.Contains(n)) return true;
        return false;
    }

    private static int? LargestNumber(string t)
    {
        int? max = null;
        foreach (Match m in Regex.Matches(t, @"\d+"))
            if (int.TryParse(m.Value, out var n) && (max is null || n > max)) max = n;
        return max;
    }

    private static int? FirstNumberBefore(string t, string unit)
    {
        var m = Regex.Match(t, @"(\d+)\s*(?:-\s*\d+\s*)?" + unit);
        return m.Success && int.TryParse(m.Groups[1].Value, out var n) ? n : null;
    }
}
