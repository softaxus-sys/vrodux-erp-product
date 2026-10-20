namespace Softaxis.LeadGen.Application.Catalog;

public sealed record RegionInfo(string Name, string NameAr, double Lat, double Lng, int RadiusMeters, string[] Areas);

/// <summary>
/// What may be done with a country's businesses. These are product rules, not legal advice —
/// each country should have a lawyer's sign-off before <see cref="Live"/> is switched on.
/// </summary>
public sealed record CountryInfo(
    string Code, string Name, string NameAr, bool Live, string PhoneRegion, string DialCode,
    string Timezone, string[] WorkingDays, string ComplianceNote, RegionInfo[] Regions);

/// <summary>
/// The places a search can target. Regions are emirates / states; areas are neighbourhoods inside
/// them, used to split a big region into several small searches (a provider returns only a few dozen
/// results per query, so "restaurants in Dubai" is run as "restaurants in Deira, Dubai", and so on).
/// Adding a country is adding data here plus the lawyer's sign-off, not new code.
/// </summary>
public static class GeoCatalog
{
    public static readonly IReadOnlyList<CountryInfo> All =
    [
        new("AE", "United Arab Emirates", "الإمارات العربية المتحدة", Live: true, "AE", "+971",
            "Asia/Dubai", ["1", "2", "3", "4", "5"],
            "UAE: B2B outreach to registered businesses. Include a clear sender identity and a working unsubscribe link, and honour every opt-out.",
        [
            new("Dubai", "دبي", 25.2048, 55.2708, 30000,
            [
                "Deira", "Bur Dubai", "Business Bay", "Downtown Dubai", "Dubai Marina", "Jumeirah Lakes Towers (JLT)",
                "Jumeirah", "Al Quoz", "Al Barsha", "Karama", "Satwa", "Al Nahda", "Mirdif", "Dubai Silicon Oasis",
                "Dubai Investments Park", "Jebel Ali", "Sheikh Zayed Road", "DIFC", "Dubai Internet City",
                "Dubai Media City", "Al Garhoud", "Al Qusais", "Dubai Festival City", "International City",
                "Motor City", "Dubai Hills", "JVC (Jumeirah Village Circle)", "Ras Al Khor", "Umm Suqeim", "Oud Metha",
            ]),
            new("Abu Dhabi", "أبوظبي", 24.4539, 54.3773, 35000,
            [
                "Abu Dhabi City Centre", "Al Reem Island", "Yas Island", "Khalifa City", "Mussafah", "Al Maryah Island",
                "Saadiyat Island", "Al Khalidiyah", "Tourist Club Area", "Electra Street", "Hamdan Street",
                "Al Raha", "Masdar City", "Al Ain", "Madinat Zayed", "Ruwais",
            ]),
            new("Sharjah", "الشارقة", 25.3463, 55.4209, 20000,
            [
                "Al Majaz", "Al Nahda Sharjah", "Al Qasimia", "Industrial Area Sharjah", "University City",
                "Muwaileh", "Al Khan", "Sharjah Airport Free Zone (SAIF)", "Hamriyah Free Zone",
            ]),
            new("Ajman", "عجمان", 25.4052, 55.5136, 12000,
            ["Ajman City Centre", "Al Nuaimiya", "Al Jurf", "Ajman Free Zone", "Al Rashidiya"]),
            new("Umm Al Quwain", "أم القيوين", 25.5647, 55.5552, 15000,
            ["UAQ City", "UAQ Free Trade Zone", "Al Salama"]),
            new("Ras Al Khaimah", "رأس الخيمة", 25.7895, 55.9432, 25000,
            ["Al Nakheel", "Al Hamra", "RAKEZ", "Al Dhait", "Khuzam", "Mina Al Arab"]),
            new("Fujairah", "الفجيرة", 25.1288, 56.3265, 20000,
            ["Fujairah City", "Dibba Al Fujairah", "Al Faseel", "Fujairah Free Zone"]),
        ]),

        // Listed so the picker can show what is coming. A search is refused until Live is true AND
        // the platform setting AllowedCountries includes it.
        Planned("SA", "Saudi Arabia", "المملكة العربية السعودية", "+966", "Asia/Riyadh"),
        Planned("QA", "Qatar", "قطر", "+974", "Asia/Qatar"),
        Planned("KW", "Kuwait", "الكويت", "+965", "Asia/Kuwait"),
        Planned("BH", "Bahrain", "البحرين", "+973", "Asia/Bahrain"),
        Planned("OM", "Oman", "عُمان", "+968", "Asia/Muscat"),
        Planned("PK", "Pakistan", "باكستان", "+92", "Asia/Karachi"),
        Planned("GB", "United Kingdom", "المملكة المتحدة", "+44", "Europe/London"),
        Planned("US", "United States", "الولايات المتحدة", "+1", "America/New_York"),
        Planned("CA", "Canada", "كندا", "+1", "America/Toronto"),
        Planned("AU", "Australia", "أستراليا", "+61", "Australia/Sydney"),
    ];

    private static CountryInfo Planned(string code, string name, string nameAr, string dial, string tz) =>
        new(code, name, nameAr, Live: false, code, dial, tz, ["1", "2", "3", "4", "5"],
            "Not available yet.", []);

    public static CountryInfo? Get(string? code) =>
        All.FirstOrDefault(c => string.Equals(c.Code, code, StringComparison.OrdinalIgnoreCase));

    public static RegionInfo? Region(string? country, string? region) =>
        Get(country)?.Regions.FirstOrDefault(r => string.Equals(r.Name, region, StringComparison.OrdinalIgnoreCase));
}
