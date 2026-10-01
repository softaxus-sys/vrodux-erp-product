using System.Globalization;
using System.Text.RegularExpressions;

namespace Softaxis.RealEstate.Domain.Entities;

/// <summary>
/// Reads the end of a tenancy out of the sheet's own wording — "700k(rented till 29 feb 2026 in 55k)".
///
/// <para>These sheets rarely have a column for it; the date lives inside the price cell. Returns
/// null rather than a guess when there is no "rented till …" phrase or no readable date after it:
/// a vacancy alert on a wrong date is worse than none.</para>
/// </summary>
public static partial class RentedTill
{
    /// <summary>yyyy-MM-dd, or null.</summary>
    public static string? FromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var phrase = PhraseRe().Match(text);
        if (!phrase.Success) return null;

        var rest = phrase.Groups[1].Value;

        // "29 feb 2026", "feb 2026", "29-Feb-26".
        var named = NamedMonthRe().Match(rest);
        if (named.Success && MonthNumber(named.Groups["m"].Value) is { } month)
        {
            int? day = int.TryParse(named.Groups["d"].Value, out var d) ? d : null;
            return Build(Year(named.Groups["y"].Value), month, day);
        }

        // "29/02/2026" — day first, these are UAE sheets.
        var numeric = NumericRe().Match(rest);
        if (numeric.Success
            && int.TryParse(numeric.Groups["d"].Value, out var nd)
            && int.TryParse(numeric.Groups["m"].Value, out var nm))
            return Build(Year(numeric.Groups["y"].Value), nm, nd);

        return null;
    }

    private static string? Build(int year, int month, int? day)
    {
        if (month is < 1 or > 12 || year is < 2000 or > 2100) return null;

        // A month with no day means the end of it. The day is also clamped: "29 feb 2026" is a real
        // cell, and 2026 has no 29 February.
        var last = DateTime.DaysInMonth(year, month);
        var d = Math.Clamp(day ?? last, 1, last);

        return new DateTime(year, month, d).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static int Year(string raw) =>
        int.TryParse(raw, out var y) ? (y < 100 ? 2000 + y : y) : 0;

    private static int? MonthNumber(string raw)
    {
        var t = raw.ToLowerInvariant();
        string[] months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        for (var i = 0; i < months.Length; i++)
            if (t.StartsWith(months[i])) return i + 1;
        return null;
    }

    [GeneratedRegex(@"(?:rented|leased|tenanted|occupied|tenant)\s*(?:till|til|until|upto|up\s*to|to)\s*(.+)", RegexOptions.IgnoreCase)]
    private static partial Regex PhraseRe();

    [GeneratedRegex(@"(?:(?<d>\d{1,2})\s*(?:st|nd|rd|th)?[\s\-/.,]*)?(?<m>[a-z]{3,9})[\s\-/.,]*(?<y>\d{4}|\d{2})\b", RegexOptions.IgnoreCase)]
    private static partial Regex NamedMonthRe();

    [GeneratedRegex(@"(?<d>\d{1,2})[/\-.](?<m>\d{1,2})[/\-.](?<y>\d{4}|\d{2})\b")]
    private static partial Regex NumericRe();
}
