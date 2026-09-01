using System.Globalization;

namespace Softaxis.RealEstate.Infrastructure.Handlers;

/// <summary>
/// Reads a number out of a spreadsheet cell.
///
/// <para>Cells are text, and real files carry "1,200.00", "AED 4,500", "1 200" or a stray "-". None of
/// those bind to a decimal, and rejecting them would fail the whole batch over one badly formatted
/// column. Anything unreadable falls back to the caller's default so the row still imports — an area
/// of zero is a visible gap someone can correct, a rejected import is 500 rows lost.</para>
///
/// <para>Parsed with the invariant culture after stripping separators, so the result does not depend
/// on the server's locale — the same file must import identically wherever it runs.</para>
/// </summary>
internal static class ImportNumber
{
    public static decimal Decimal(string? raw, decimal fallback = 0m)
    {
        var cleaned = Clean(raw);
        return cleaned is null ? fallback
             : decimal.TryParse(cleaned, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) ? value
             : fallback;
    }

    public static int Int(string? raw, int fallback = 0) =>
        (int)System.Math.Round(Decimal(raw, fallback));

    /// <summary>Null when the cell was blank — lets a nullable column stay null rather than become 0.</summary>
    public static int? NullableInt(string? raw)
    {
        var cleaned = Clean(raw);
        if (cleaned is null) return null;
        return decimal.TryParse(cleaned, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
            ? (int)System.Math.Round(value)
            : null;
    }

    /// <summary>
    /// Strips everything that is not a digit, a dot or a leading minus.
    ///
    /// <para>Refuses a magnitude suffix rather than misreading it: "4.5M" would otherwise strip to
    /// "4.5" and import a four-and-a-half million dirham valuation as four dirhams fifty. Returning
    /// null falls back to zero, which reads as a visible gap someone can fill — a confidently wrong
    /// small number does not.</para>
    /// </summary>
    private static string? Clean(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        if (HasMagnitudeSuffix(raw)) return null;

        var negative = raw.TrimStart().StartsWith('-');
        var digits   = new string(raw.Where(c => char.IsAsciiDigit(c) || c == '.').ToArray());

        if (digits.Length == 0 || digits == ".") return null;
        return negative ? "-" + digits : digits;
    }

    /// <summary>Units that multiply the number written next to them, in the markets this serves.</summary>
    private static readonly string[] Magnitudes = ["m", "mn", "k", "bn", "cr", "crore", "lakh", "lac"];

    private static bool HasMagnitudeSuffix(string raw)
    {
        // Only the trailing word counts, so "Marina 2 Tower" is not read as a magnitude while
        // "4.5 M" and "250k" are.
        var tail = new string(raw.TrimEnd().Reverse().TakeWhile(char.IsLetter).Reverse().ToArray());
        return tail.Length > 0 && Magnitudes.Contains(tail.ToLowerInvariant());
    }
}
