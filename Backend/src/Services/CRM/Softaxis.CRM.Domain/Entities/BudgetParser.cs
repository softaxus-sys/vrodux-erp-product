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
        var t = budget.Trim().ToLowerInvariant();

        // "<number><optional-suffix>" tokens: 50k · 100,000 · 1.5m · 5 lakh · 2 crore.
        var values = new List<decimal>();
        var sawSuffix = false;
        var sawSeparator = t.Contains(',');
        foreach (Match mt in Regex.Matches(t,
            @"(\d[\d,\.]*)\s*(k|m|mn|bn|thousand|thousands|lakh|lac|lakhs|crore|cr|million|billion)?"))
        {
            var numRaw = mt.Groups[1].Value.Replace(",", "");
            if (!decimal.TryParse(numRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) || n == 0)
                continue;
            var suffix = mt.Groups[2].Value;
            if (!string.IsNullOrEmpty(suffix)) sawSuffix = true;
            values.Add(n * Multiplier(suffix));
        }

        if (values.Count == 0) return null;

        // A range ("50k-100k") → midpoint of the smallest & largest captured magnitudes.
        var estimate = (values.Min() + values.Max()) / 2m;

        // Bare small numbers with no unit suffix and no thousands separator (e.g. "50", "75-100")
        // are shorthand for thousands in these markets — "50" means 50,000, not 50 currency units.
        if (!sawSuffix && !sawSeparator && estimate > 0 && estimate < 1000)
            estimate *= 1_000m;

        return decimal.Round(estimate, 2);
    }

    private static decimal Multiplier(string suffix) => suffix switch
    {
        "k" or "thousand" or "thousands" => 1_000m,
        "lakh" or "lac" or "lakhs"       => 100_000m,
        "m" or "mn" or "million"         => 1_000_000m,
        "cr" or "crore"                  => 10_000_000m,
        "bn" or "billion"                => 1_000_000_000m,
        _                                => 1m,
    };
}
