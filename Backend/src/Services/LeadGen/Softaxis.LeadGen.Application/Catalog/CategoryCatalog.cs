namespace Softaxis.LeadGen.Application.Catalog;

/// <param name="Key">Stable id stored on searches and prospects.</param>
/// <param name="Query">The phrase sent to the data provider ("dental clinic").</param>
public sealed record BusinessCategory(string Key, string Label, string LabelAr, string Group, string Query);

/// <summary>
/// The kinds of business a workspace can look for. A key is stable; the label can be reworded.
/// Every category should be something a registered company would plausibly buy B2B services from.
/// </summary>
public static class CategoryCatalog
{
    private static BusinessCategory C(string key, string label, string ar, string group, string? query = null) =>
        new(key, label, ar, group, query ?? label.ToLowerInvariant());

    public static readonly IReadOnlyList<BusinessCategory> All =
    [
        // Food & hospitality
        C("restaurant", "Restaurants", "مطاعم", "Food & Hospitality", "restaurant"),
        C("cafe", "Cafés & coffee shops", "مقاهي", "Food & Hospitality", "cafe"),
        C("bakery", "Bakeries", "مخابز", "Food & Hospitality", "bakery"),
        C("catering", "Catering companies", "شركات تموين", "Food & Hospitality", "catering company"),
        C("hotel", "Hotels", "فنادق", "Food & Hospitality", "hotel"),
        C("hotel_apartment", "Hotel apartments & serviced stays", "شقق فندقية", "Food & Hospitality", "hotel apartments"),
        C("cloud_kitchen", "Cloud kitchens", "مطابخ سحابية", "Food & Hospitality", "cloud kitchen"),

        // Health & wellness
        C("clinic", "Medical clinics", "عيادات", "Health & Wellness", "medical clinic"),
        C("dental", "Dental clinics", "عيادات أسنان", "Health & Wellness", "dental clinic"),
        C("hospital", "Hospitals", "مستشفيات", "Health & Wellness", "hospital"),
        C("pharmacy", "Pharmacies", "صيدليات", "Health & Wellness", "pharmacy"),
        C("laboratory", "Medical laboratories", "مختبرات طبية", "Health & Wellness", "medical laboratory"),
        C("physio", "Physiotherapy centres", "علاج طبيعي", "Health & Wellness", "physiotherapy clinic"),
        C("veterinary", "Veterinary clinics", "عيادات بيطرية", "Health & Wellness", "veterinary clinic"),
        C("salon", "Salons & barbers", "صالونات", "Health & Wellness", "beauty salon"),
        C("spa", "Spas & wellness centres", "مراكز سبا", "Health & Wellness", "spa"),
        C("gym", "Gyms & fitness studios", "نوادي رياضية", "Health & Wellness", "gym fitness center"),

        // Real estate
        C("real_estate_agency", "Real estate agencies", "وكالات عقارية", "Real Estate", "real estate agency"),
        C("property_management", "Property management companies", "إدارة الأملاك", "Real Estate", "property management company"),
        C("developer", "Property developers", "مطورون عقاريون", "Real Estate", "real estate developer"),
        C("facility_management", "Facility management", "إدارة المرافق", "Real Estate", "facilities management company"),

        // Retail
        C("supermarket", "Supermarkets & groceries", "سوبرماركت", "Retail", "supermarket"),
        C("fashion_retail", "Fashion & apparel stores", "متاجر أزياء", "Retail", "clothing store"),
        C("electronics_retail", "Electronics stores", "متاجر إلكترونيات", "Retail", "electronics store"),
        C("furniture", "Furniture stores", "متاجر أثاث", "Retail", "furniture store"),
        C("jewellery", "Jewellers", "مجوهرات", "Retail", "jewelry store"),
        C("florist", "Florists & gifts", "محلات زهور وهدايا", "Retail", "florist"),
        C("perfume", "Perfume & oud shops", "عطور وعود", "Retail", "perfume shop"),
        C("hardware", "Hardware & building materials", "أدوات ومواد بناء", "Retail", "hardware store"),

        // Automotive
        C("car_dealer", "Car dealers", "وكلاء سيارات", "Automotive", "car dealer"),
        C("garage", "Garages & auto repair", "ورش سيارات", "Automotive", "car repair garage"),
        C("car_rental", "Car rental companies", "تأجير سيارات", "Automotive", "car rental"),
        C("spare_parts", "Auto spare parts", "قطع غيار", "Automotive", "auto spare parts"),
        C("driving_school", "Driving schools", "مدارس قيادة", "Automotive", "driving school"),

        // Construction & trades
        C("contractor", "General contractors", "مقاولون", "Construction & Trades", "general contractor"),
        C("interior_design", "Interior design & fit-out", "تصميم داخلي وتجهيز", "Construction & Trades", "interior design fit out company"),
        C("mep", "MEP & HVAC contractors", "مقاولات كهروميكانيكية", "Construction & Trades", "MEP HVAC contractor"),
        C("architect", "Architects & engineering consultants", "مكاتب هندسية", "Construction & Trades", "architectural engineering consultant"),
        C("cleaning", "Cleaning companies", "شركات تنظيف", "Construction & Trades", "cleaning company"),
        C("pest_control", "Pest control", "مكافحة الحشرات", "Construction & Trades", "pest control"),
        C("landscaping", "Landscaping", "تنسيق حدائق", "Construction & Trades", "landscaping company"),
        C("security_services", "Security services", "خدمات أمنية", "Construction & Trades", "security services company"),

        // Education
        C("school", "Schools", "مدارس", "Education", "school"),
        C("nursery", "Nurseries", "حضانات", "Education", "nursery"),
        C("training_center", "Training centres", "مراكز تدريب", "Education", "training center"),
        C("tutoring", "Tutoring & language institutes", "معاهد ولغات", "Education", "language institute"),
        C("university", "Universities & colleges", "جامعات وكليات", "Education", "university college"),

        // Professional services
        C("law_firm", "Law firms", "مكاتب محاماة", "Professional Services", "law firm"),
        C("accounting", "Accounting & audit firms", "مكاتب محاسبة", "Professional Services", "accounting audit firm"),
        C("consultancy", "Management consultancies", "شركات استشارية", "Professional Services", "management consultancy"),
        C("business_setup", "Business setup & PRO services", "تأسيس شركات", "Professional Services", "business setup services"),
        C("insurance_broker", "Insurance brokers", "وسطاء تأمين", "Professional Services", "insurance broker"),
        C("recruitment", "Recruitment agencies", "شركات توظيف", "Professional Services", "recruitment agency"),
        C("travel_agency", "Travel agencies", "وكالات سفر", "Professional Services", "travel agency"),
        C("it_company", "IT & software companies", "شركات تقنية", "Professional Services", "IT company software"),
        C("marketing_agency", "Marketing & advertising agencies", "وكالات تسويق", "Professional Services", "marketing advertising agency"),
        C("printing", "Printing & signage", "مطابع ولافتات", "Professional Services", "printing press signage"),
        C("photography", "Photography & video production", "تصوير وإنتاج", "Professional Services", "photography video production"),
        C("event_management", "Event management", "تنظيم فعاليات", "Professional Services", "event management company"),
        C("visa_services", "Visa & typing services", "خدمات تأشيرات وطباعة", "Professional Services", "visa typing services"),

        // Trade & logistics
        C("trading", "General trading companies", "شركات تجارة عامة", "Trade & Logistics", "general trading company"),
        C("freight", "Freight forwarders", "شحن وتخليص", "Trade & Logistics", "freight forwarding company"),
        C("courier", "Courier & delivery", "توصيل وبريد سريع", "Trade & Logistics", "courier delivery company"),
        C("warehousing", "Warehousing", "مستودعات", "Trade & Logistics", "warehouse storage"),
        C("wholesale", "Wholesalers & distributors", "تجارة جملة وتوزيع", "Trade & Logistics", "wholesale distributor"),
        C("manufacturer", "Manufacturers & factories", "مصانع", "Trade & Logistics", "manufacturing factory"),
        C("import_export", "Import & export companies", "استيراد وتصدير", "Trade & Logistics", "import export company"),
    ];

    public static BusinessCategory? Get(string? key) =>
        All.FirstOrDefault(c => string.Equals(c.Key, key, StringComparison.OrdinalIgnoreCase));

    public static bool IsValid(string? key) => Get(key) is not null;
}
