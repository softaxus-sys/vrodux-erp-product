using System.Text.RegularExpressions;

namespace Softaxis.Inventory.Application.Products.Queries.LookupProductByCode;

/// <summary>
/// Turns whatever a scanner read into the codes worth searching for. A camera returns the raw text of
/// whatever is printed: an EAN, a QR holding a web link ("https://brand.com/01/06291234567890"), a GS1 element
/// string ("(01)06291234567890(17)261231"), or a shop's own SKU. Only the first two carry a barcode number.
/// </summary>
public static class ScannedCode
{
    private static readonly Regex Digits = new(@"^\d+$", RegexOptions.Compiled);
    private static readonly Regex Gs1Bracketed = new(@"\(01\)\s*(\d{14})", RegexOptions.Compiled);
    private static readonly Regex Gs1Plain = new(@"^01(\d{14})(?:\D|\d{2}|$)", RegexOptions.Compiled);
    private static readonly string[] CodeParams = ["gtin", "barcode", "ean", "upc", "code", "sku", "id"];

    public sealed record Parsed(string Primary, string? Gtin, IReadOnlyList<string> Candidates);

    /// <summary>Returns null when there is nothing usable in the scan.</summary>
    public static Parsed? Parse(string? raw)
    {
        var text = (raw ?? "").Trim();
        if (text.Length == 0) return null;

        var primary = Extract(text);
        if (primary.Length == 0) return null;

        string? gtin = null;
        var candidates = new List<string> { primary };

        if (Digits.IsMatch(primary) && primary.Length is 8 or 12 or 13 or 14)
        {
            // The same product is printed as UPC-A (12), EAN-13 or GTIN-14, and a shop may have typed it
            // with or without the leading zeros. Search every spelling.
            var core = primary.TrimStart('0');
            if (core.Length == 0) return null;
            foreach (var len in new[] { 8, 12, 13, 14 })
            {
                if (core.Length <= len) candidates.Add(core.PadLeft(len, '0'));
            }
            candidates.Add(core);
            gtin = core.Length <= 8 ? core.PadLeft(8, '0') : core.Length <= 13 ? core.PadLeft(13, '0') : core.PadLeft(14, '0');
        }

        return new Parsed(primary, gtin, candidates.Distinct(StringComparer.Ordinal).ToList());
    }

    private static string Extract(string text)
    {
        var bracketed = Gs1Bracketed.Match(text);
        if (bracketed.Success) return bracketed.Groups[1].Value;

        if (Uri.TryCreate(text, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            // GS1 Digital Link: .../01/<gtin>[/10/<lot>...]
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            for (var i = 0; i < segments.Length - 1; i++)
            {
                if (segments[i] == "01" && Digits.IsMatch(segments[i + 1])) return segments[i + 1];
            }
            foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = pair.Split('=', 2);
                if (kv.Length == 2 && CodeParams.Contains(kv[0], StringComparer.OrdinalIgnoreCase) && kv[1].Length > 0)
                    return Uri.UnescapeDataString(kv[1]).Trim();
            }
            // A link we cannot read a code from (a brand's home page) is not a product code. Returning it
            // would search the catalogue for a web address, so return nothing instead.
            return segments.Length > 0 && Digits.IsMatch(segments[^1]) ? segments[^1] : "";
        }

        var plain = Gs1Plain.Match(text);
        if (plain.Success && text.Length >= 16) return plain.Groups[1].Value;

        return text;
    }
}
