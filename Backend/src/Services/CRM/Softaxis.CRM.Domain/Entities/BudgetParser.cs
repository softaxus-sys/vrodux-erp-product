using System.Globalization;
using System.Text.RegularExpressions;

namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// Best-effort parse of a free-text budget ("50k–100k", "AED 500,000", "1.5M", "5 lakh",
/// "2 crore", "&gt;500k") into a single numeric estimate. Ranges collapse to the midpoint.
/// Returns null when nothing numeric can be read. Currency-agnostic — strips symbols/codes and
/// returns the magnitude in the lead's own currency (no FX conversion, per the Module 6e model).
/// </summary>
public static class BudgetParser
{
    public static decimal? Parse(string? budget)
    {
        if (string.IsNullOrWhiteSpace(budget)) return null;
        // Meta/form option values arrive underscore/dash-joined ("up_to_60_lakh", "60_lakh_to_1_crore"),
        // which detaches the unit from the number — normalize separators to spaces so "60 lakh" parses.
        var t = budget.Trim().ToLowerInvariant().Replace('_', ' ').Replace('/', ' ');

        // Each token = a number + the WHOLE trailing word (so a unit only matches when the word is
        // exactly a unit — "50 luxury" captures "luxury" → not a unit → no false "50 lakh").
        var tokens = new List<(decimal Num, decimal Mul, bool HasUnit)>();
        var sawSeparator = t.Contains(',');
        foreach (Match mt in Regex.Matches(t, @"(\d[\d,\.]*)\s*([a-z]{1,10})?"))
        {
            var numRaw = mt.Groups[1].Value.Replace(",", "");
            if (!decimal.TryParse(numRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) || n == 0)
                continue;
            var mul = Multiplier(mt.Groups[2].Value);   // 1 for a non-unit / missing word
            tokens.Add((n, mul, mul != 1m));
        }

        if (tokens.Count == 0) return null;

        // In a range where the unit is stated once ("2-3 crore", "50-100k"), let the unitless numbers
        // inherit the largest unit present, so both ends are on the same scale.
        var maxUnit = tokens.Where(x => x.HasUnit).Select(x => x.Mul).DefaultIfEmpty(1m).Max();
        var magnitudes = tokens.Select(x => x.HasUnit ? x.Num * x.Mul : x.Num * maxUnit).ToList();
        var sawUnit = tokens.Any(x => x.HasUnit);

        // A range → midpoint of the smallest & largest captured magnitudes.
        var estimate = (magnitudes.Min() + magnitudes.Max()) / 2m;

        // Confidence guard: a bare small number with no unit (k/m/lakh/crore) and no thousands
        // separator — e.g. "50", "500" — is genuinely ambiguous (50? 50k? 50 lakh?). Guessing a
        // multiplier produced misleading "static 50,000" values, so we DON'T guess: return null and
        // let the UI show the raw budget text instead. Trust only explicit magnitudes.
        if (!sawUnit && !sawSeparator && estimate < 10_000m)
            return null;

        return decimal.Round(estimate, 2);
    }

    /// <summary>Parse a value from a longer free-text field (e.g. the lead's message or interest),
    /// but ONLY when it contains a money cue (currency, lakh/crore/k/m, "budget"/"price"/"invest") —
    /// otherwise returns null, so we never mistake a phone number or year for a budget.</summary>
    public static decimal? ParseFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var t = text.ToLowerInvariant();
        if (!Regex.IsMatch(t, @"lakh|lac|crore|\bcr\b|million|billion|\bk\b|\bm\b|pkr|rs\.?|aed|usd|dirham|rupee|\$|£|€|budget|price|invest"))
            return null;
        return Parse(text);
    }

    // Unit multipliers. Lakh (1e5) and crore (1e7) are the South-Asian units used for PKR/INR budgets;
    // "l"/"cr" are their common shorthands. 1 lakh = 0.1 million, 10 lakh = 1 million, 1 crore = 10 million.
    private static decimal Multiplier(string suffix) => suffix switch
    {
        "k" or "thousand" or "thousands"        => 1_000m,
        "l" or "lakh" or "lakhs" or "lac" or "lacs" => 100_000m,
        "m" or "mn" or "million"                => 1_000_000m,
        "cr" or "crore" or "crores"             => 10_000_000m,
        "bn" or "billion"                       => 1_000_000_000m,
        _                                       => 1m,
    };
}
