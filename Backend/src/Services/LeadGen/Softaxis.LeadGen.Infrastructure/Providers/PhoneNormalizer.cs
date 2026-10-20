using PhoneNumbers;

namespace Softaxis.LeadGen.Infrastructure.Providers;

public sealed record PhoneInfo(string E164, string Display, string Type);

/// <summary>
/// Turns whatever a directory or a website printed into one canonical number, and says whether it
/// is a mobile (which in the Gulf is almost always on WhatsApp) or a landline. A number that does
/// not parse as a real one for its country is dropped rather than kept as text — a dead number
/// helps nobody and inflates the quality score.
/// </summary>
public static class PhoneNormalizer
{
    private static readonly PhoneNumberUtil Util = PhoneNumberUtil.GetInstance();

    public static PhoneInfo? Normalize(string? raw, string defaultRegion)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            var text = raw.Trim();
            // "00971…" is the international prefix written the old way.
            if (text.StartsWith("00")) text = "+" + text[2..];
            var number = Util.Parse(text, defaultRegion.ToUpperInvariant());
            if (!Util.IsValidNumber(number)) return null;

            var type = Util.GetNumberType(number) switch
            {
                PhoneNumberType.MOBILE => "mobile",
                PhoneNumberType.FIXED_LINE => "landline",
                PhoneNumberType.FIXED_LINE_OR_MOBILE => "unknown",
                PhoneNumberType.VOIP => "voip",
                PhoneNumberType.TOLL_FREE or PhoneNumberType.PREMIUM_RATE or PhoneNumberType.SHARED_COST => "service",
                _ => "unknown",
            };
            // Toll-free and premium numbers reach a call centre, not the business.
            if (type == "service") return null;

            return new PhoneInfo(
                Util.Format(number, PhoneNumberFormat.E164),
                Util.Format(number, PhoneNumberFormat.INTERNATIONAL),
                type);
        }
        catch (NumberParseException) { return null; }
    }

    /// <summary>Digits only, for comparing against a suppression entry.</summary>
    public static string Digits(string? s) => new((s ?? "").Where(char.IsDigit).ToArray());
}
