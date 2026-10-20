namespace Softaxis.LeadGen.Application.Setup;

/// <param name="Offer">One sentence, {name} is replaced by the business name.</param>
public sealed record IndustrySuggestion(string Offer, string TargetCustomers, string[] Categories);

/// <summary>
/// A sensible starting point for "what you offer" and "who you sell to", derived from the industry the
/// workspace chose at signup. It only fills a blank profile; the owner edits it freely. Category keys
/// must exist in <see cref="Catalog.CategoryCatalog"/> (invalid ones are dropped when applied).
/// </summary>
public static class ProfileSuggestions
{
    private static string Norm(string? s) => new string((s ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

    private static readonly Dictionary<string, IndustrySuggestion> Map = new()
    {
        [Norm("Retail & E-Commerce")] = new("{name} supplies quality products to retail and business customers with reliable delivery.",
            "Restaurants and cafés, offices and corporate buyers, hotels and serviced apartments",
            ["restaurant", "cafe", "hotel", "catering", "supermarket"]),
        [Norm("Real Estate")] = new("{name} helps property owners, developers and investors buy, sell, lease and manage property.",
            "Property developers, facility and property management companies, interior design and fit-out firms",
            ["developer", "property_management", "facility_management", "interior_design", "contractor"]),
        [Norm("Construction")] = new("{name} delivers construction, fit-out and contracting work on time and to specification.",
            "Developers, MEP and fit-out contractors, architects and consultants",
            ["developer", "contractor", "mep", "architect", "interior_design"]),
        [Norm("Hospitality & Tourism")] = new("{name} provides hospitality and travel services, from stays and tours to group and corporate bookings.",
            "Hotels and serviced apartments, restaurants and caterers, travel agencies and event companies",
            ["hotel", "hotel_apartment", "restaurant", "catering", "travel_agency", "event_management"]),
        [Norm("Healthcare")] = new("{name} supports healthcare providers with the products and services they need to run their practice.",
            "Medical and dental clinics, pharmacies and laboratories, physiotherapy and wellness centres",
            ["clinic", "dental", "pharmacy", "laboratory", "physio"]),
        [Norm("Education")] = new("{name} provides education and learning services and solutions to institutions and learners.",
            "Private schools and nurseries, training centres, universities and tutoring centres",
            ["school", "nursery", "training_center", "university", "tutoring"]),
        [Norm("Library")] = new("{name} supplies books, library management and learning resources to institutions.",
            "Schools and universities, training centres, corporate and community libraries",
            ["school", "university", "training_center", "nursery"]),
        [Norm("Import & Export")] = new("{name} handles international trade, sourcing, import and export for businesses.",
            "Trading and wholesale companies, freight forwarders and warehouses, manufacturers",
            ["trading", "wholesale", "freight", "warehousing", "manufacturer", "import_export"]),
        [Norm("Visa Services")] = new("{name} handles visas, company set-up and government paperwork so businesses and families can focus on work.",
            "Newly set-up companies, HR and recruitment firms, travel agencies and business-setup consultants",
            ["business_setup", "recruitment", "travel_agency", "consultancy", "contractor"]),
        [Norm("Manufacturing")] = new("{name} manufactures products to specification and supplies them in volume to businesses.",
            "Wholesalers and distributors, trading companies, construction and contracting firms",
            ["wholesale", "trading", "contractor", "hardware", "import_export"]),
        [Norm("Finance & Banking")] = new("{name} provides financial and advisory services that help businesses grow and stay compliant.",
            "Accounting and law firms, business-setup consultants, insurance brokers, growing SMEs",
            ["accounting", "law_firm", "business_setup", "insurance_broker", "consultancy"]),
        [Norm("Logistics & Supply Chain")] = new("{name} moves, stores and tracks goods reliably for businesses.",
            "Trading and wholesale companies, manufacturers, e-commerce retailers and importers",
            ["trading", "wholesale", "manufacturer", "import_export", "warehousing"]),
        [Norm("Food & Beverage")] = new("{name} supplies food and beverage products and services to hospitality and retail businesses.",
            "Restaurants, cafés and bakeries, hotels and caterers, supermarkets",
            ["restaurant", "cafe", "bakery", "hotel", "catering", "supermarket"]),
        [Norm("Technology & IT")] = new("{name} builds and supports software and IT solutions that help businesses work faster and cost less.",
            "Growing SMEs, accounting and law firms, clinics, schools and logistics companies",
            ["clinic", "school", "accounting", "law_firm", "trading", "real_estate_agency"]),
        [Norm("Wholesale & Distribution")] = new("{name} supplies goods in volume to retailers and businesses at competitive prices.",
            "Supermarkets and retailers, restaurants and hotels, other traders and importers",
            ["supermarket", "restaurant", "hotel", "hardware", "trading"]),
        [Norm("Professional Services")] = new("{name} provides professional services that help businesses start, run and grow.",
            "Growing SMEs, new company set-ups, clinics, real-estate and trading companies",
            ["business_setup", "clinic", "real_estate_agency", "trading", "contractor"]),
        [Norm("Agriculture")] = new("{name} supplies fresh and quality agricultural produce to businesses.",
            "Supermarkets, restaurants and hotels, wholesale and food-trading companies",
            ["supermarket", "restaurant", "hotel", "wholesale", "trading"]),
    };

    /// <summary>Null for an unknown or generic industry ("All Industries", "Other") — we do not guess.</summary>
    public static IndustrySuggestion? For(string? industry) =>
        Map.TryGetValue(Norm(industry), out var s) ? s : null;

    public static string OfferFor(IndustrySuggestion s, string? businessName) =>
        s.Offer.Replace("{name}", string.IsNullOrWhiteSpace(businessName) ? "We" : businessName.Trim());
}
