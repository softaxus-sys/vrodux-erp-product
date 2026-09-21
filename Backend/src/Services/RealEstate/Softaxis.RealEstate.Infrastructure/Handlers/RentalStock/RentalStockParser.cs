using System.Globalization;
using System.Text.RegularExpressions;

namespace Softaxis.RealEstate.Infrastructure.Handlers.RentalStock;

/// <summary>
/// Reads the columns of an agency rental-stock sheet, which are written for people rather than for
/// software: rent as "48K/1" (48,000 over one cheque), beds as "2bhk+maids", furnishing spelled
/// eleven different ways.
///
/// <para>Every rule here comes from a real file. Where a value cannot be read with confidence it
/// returns null rather than a guess — a blank an agent can fill is recoverable, a plausible wrong
/// number sitting in a rent column is not.</para>
/// </summary>
internal static partial class RentalStockParser
{
    // ── Rent ──────────────────────────────────────────────────────────────────

    /// <summary>Annual rent and the number of cheques, from the sheet's price column.</summary>
    /// <remarks>
    /// Handles the shapes actually present: "200K", "48K/1", "425K/2CQ.", "72K/4 CQ.",
    /// "1.5M", "14K PER MONTH", "90K TO 100K".
    /// </remarks>
    /// <param name="annualise">
    /// False for a sale sheet. "1.2M per month" is a rent to be multiplied up; the same words on an
    /// asking price are not, and multiplying one by twelve produces a number nobody is asking.
    /// </param>
    public static (decimal? AnnualRent, int? Cheques) ParseRent(string? raw, bool annualise = true)
    {
        if (string.IsNullOrWhiteSpace(raw)) return (null, null);

        // Commas are stripped, not spaced out: "10,500 monthly" is ten and a half thousand a
        // month, and splitting it left the parser reading 10.
        var text = raw.Replace(",", string.Empty).Trim();

        var amount = AmountRe().Match(text);
        if (!amount.Success) return (null, null);

        if (!decimal.TryParse(amount.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
            return (null, null);

        value *= amount.Groups[2].Value.ToLowerInvariant() switch
        {
            "k" => 1_000m,
            "m" => 1_000_000m,
            _   => 1m,
        };

        // "14K PER MONTH" is a monthly figure in a column that otherwise holds annual rent. Storing
        // it as-is would understate the unit by a factor of twelve.
        if (annualise && MonthlyRe().IsMatch(text)) value *= 12m;

        // A bare number under 1,000 in a rent column is not a rent — it is a fragment of something
        // this parser did not understand. Refused rather than stored.
        if (value < 1_000m) return (null, null);

        // Cheque count, where written. Deliberately read only when the word is present: in "48K/1"
        // the 1 is a cheque count by convention, but a lone trailing digit is too weak a signal on
        // its own, so that shape is matched explicitly.
        int? cheques = null;
        var cq = ChequeRe().Match(text);
        if (cq.Success && int.TryParse(cq.Groups["n"].Value, out var n) && n is > 0 and <= 12) cheques = n;

        return (value, cheques);
    }

    // ── Bedrooms ──────────────────────────────────────────────────────────────

    /// <summary>Bedroom count. A studio is zero, which is a real answer, not a missing one.</summary>
    public static int? ParseBeds(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var text = raw.ToLowerInvariant();

        if (text.Contains("studio")) return 0;

        // "3bhk", "1 bhk", "1bk", "5bhk+maidroom villa" — the maid's room is not a bedroom.
        var m = BedsRe().Match(text);
        return m.Success && int.TryParse(m.Groups[1].Value, out var n) && n is >= 0 and <= 20 ? n : null;
    }

    // ── Furnishing ────────────────────────────────────────────────────────────

    /// <summary>
    /// Normalises the furnishing column. Values that answer a different question — "upgraded",
    /// "brand new" — return null rather than being forced into a bucket they do not belong in.
    /// </summary>
    public static string? ParseFurnishing(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        // Typos are common enough in this column to matter: UNFRNSHED, unfrurnished, fullyt.
        var t = raw.ToLowerInvariant().Replace(" ", "");

        if (t.Contains("semi")) return "semi_furnished";

        // Checked before "furnished", or every "unfurnished" would match the shorter word first.
        if (UnfurnishedRe().IsMatch(t)) return "unfurnished";
        if (FurnishedRe().IsMatch(t))   return "furnished";

        return null;
    }

    // ── Occupancy ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Occupancy from a column that in practice holds free text — dates, agent names, notes about
    /// photographs. Only a clear statement is honoured; anything else leaves the unit at its default.
    /// </summary>
    public static string? ParseStatus(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var t = raw.ToLowerInvariant();

        // "vacanct", "vaccant" appear in the real file.
        if (t.Contains("vacan") || t.Contains("vaccan")) return "vacant";
        if (t.Contains("tenant") || t.Contains("rented") || t.Contains("occupied")) return "rented";

        return null;
    }

    // ── Area ──────────────────────────────────────────────────────────────────

    /// <summary>Square feet from "1968SQFT." and friends.</summary>
    public static decimal? ParseArea(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var m = AreaRe().Match(raw.Replace(",", string.Empty));
        return m.Success
            && decimal.TryParse(m.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var v)
            && v > 0
            ? v
            : null;
    }

    // ── Purpose ───────────────────────────────────────────────────────────────

    /// <summary>
    /// rent / sale, or null when the column says neither.
    /// </summary>
    /// <remarks>
    /// Worth reading carefully rather than defaulting: the purpose decides whether the price cell
    /// is an annual rent or an asking price, and putting a 7M sale into the rent column would show
    /// as a seven-million-dirham-a-year tenancy in the rent roll.
    /// </remarks>
    public static string? ParsePurpose(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var t = raw.ToLowerInvariant();
        if (t.Contains("sale") || t.Contains("sell") || t.Contains("buy")) return "sale";
        if (t.Contains("rent") || t.Contains("lease") || t.Contains("let")) return "rent";
        return null;
    }

    // ── Category ──────────────────────────────────────────────────────────────

    /// <summary>residential / commercial / mixed, from the column beside the type.</summary>
    public static string? ParseCategory(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var t = raw.ToLowerInvariant();
        if (t.Contains("commerc")) return "commercial";
        if (t.Contains("mixed"))   return "mixed";
        if (t.Contains("resid"))   return "residential";
        return null;
    }

    // ── Yes / no ──────────────────────────────────────────────────────────────

    /// <summary>
    /// A tick-box column. Anything that is not recognisably a yes counts as no, which is the safe
    /// direction: claiming photographs exist when they do not sends an agent looking for them.
    /// </summary>
    public static bool ParseYesNo(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return false;
        var t = raw.Trim().ToLowerInvariant();
        return t is "y" or "yes" or "true" or "1" or "done" or "available"
            || t.StartsWith("yes");
    }

    // ── Dates ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// The listing date as yyyy-MM-dd, from the shapes these sheets use — "19-Sep-25",
    /// "1-Aug-26", "2026-09-12", "12/09/2026".
    /// </summary>
    /// <remarks>
    /// Day-first is tried before month-first, because these are UAE sheets and "3-6-26" means the
    /// third of June there. Returns null rather than a guess when nothing parses: a row whose date
    /// is "-------" is a real row in the file, and it is better dateless than dated wrongly.
    /// </remarks>
    public static string? ParseListedOn(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var text = raw.Trim();

        string[] formats =
        [
            "d-MMM-yy", "dd-MMM-yy", "d-MMM-yyyy", "dd-MMM-yyyy",
            "d MMM yy", "d MMM yyyy", "MMM-yy", "MMMM yyyy",
            "yyyy-MM-dd", "d/M/yyyy", "dd/MM/yyyy", "d/M/yy", "dd/MM/yy",
        ];

        if (DateTime.TryParseExact(text, formats, CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var exact))
            return exact.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        // en-GB, not the invariant culture: the invariant one reads 3/6/26 as the sixth of March.
        if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("en-GB"),
                DateTimeStyles.None, out var loose))
            return loose.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        return null;
    }

    /// <summary>Title-cases the free-text property type ("APARTMENT", "aparatment") for display.</summary>
    public static string NormaliseType(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "Apartment";

        var t = raw.ToLowerInvariant();
        if (t.Contains("villa"))     return "Villa";
        if (t.Contains("town"))      return "Townhouse";
        if (t.Contains("penthouse")) return "Penthouse";
        if (t.Contains("plot") || t.Contains("land")) return "Plot / Land";
        if (t.Contains("warehouse")) return "Warehouse";
        if (t.Contains("office"))    return "Office";
        if (t.Contains("shop") || t.Contains("retail")) return "Retail Shop";
        if (t.Contains("building") || t.Contains("tower")) return "Building";

        // "aparatment", "appartment", "apparatment" all land here rather than being preserved as typos.
        if (t.Contains("apart") || t.Contains("appart") || t.Contains("flat")) return "Apartment";

        // Anything else is kept as written, tidied. Types are free text now, so a word this does
        // not recognise is a type the workspace uses — forcing it to "Apartment", as this used to,
        // silently relabelled every plot and warehouse in the file.
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(t.Trim());
    }

    [GeneratedRegex(@"(\d+(?:\.\d+)?)\s*(k|m)?", RegexOptions.IgnoreCase)]
    private static partial Regex AmountRe();

    [GeneratedRegex(@"per\s*month|monthly|p\.?m\b", RegexOptions.IgnoreCase)]
    private static partial Regex MonthlyRe();

    // "/2CQ", "-4 CHQ", "(2 CHEQUE)", and the bare "48K/1". .NET allows the same group name in
    // both alternatives, so the count is always group "n" whichever shape matched.
    [GeneratedRegex(@"[/\-(]\s*(?<n>\d{1,2})\s*(?:ch|cq)|[/\-]\s*(?<n>\d{1,2})\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex ChequeRe();

    [GeneratedRegex(@"(\d+)\s*(?:bhk|bh|bk|bed|br\b)", RegexOptions.IgnoreCase)]
    private static partial Regex BedsRe();

    [GeneratedRegex(@"unfurn|unfrn|unfrurn|notfurn", RegexOptions.IgnoreCase)]
    private static partial Regex UnfurnishedRe();

    [GeneratedRegex(@"furnish|furnsh|fitted", RegexOptions.IgnoreCase)]
    private static partial Regex FurnishedRe();

    [GeneratedRegex(@"(\d+(?:\.\d+)?)\s*(?:sq|sf)", RegexOptions.IgnoreCase)]
    private static partial Regex AreaRe();

}
