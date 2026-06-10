// ── Country → { states, currency, timezone, currencySymbol } ──────────────────

export interface CountryMeta {
  name: string;
  code: string;
  currency: string;
  currencyCode: string;
  timezone: string;
  stateLabel: string; // "State" | "Province" | "Emirate" | "Region" | etc.
  states: string[];
}

export const COUNTRIES: CountryMeta[] = [
  {
    name: "United Arab Emirates", code: "AE",
    currency: "AED - UAE Dirham", currencyCode: "AED",
    timezone: "Asia/Dubai",
    stateLabel: "Emirate",
    states: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"],
  },
  {
    name: "Saudi Arabia", code: "SA",
    currency: "SAR - Saudi Riyal", currencyCode: "SAR",
    timezone: "Asia/Riyadh",
    stateLabel: "Region",
    states: ["Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk", "Hail", "Najran", "Jizan", "Al Jawf", "Al Bahah", "Al Qassim", "Jawf"],
  },
  {
    name: "Pakistan", code: "PK",
    currency: "PKR - Pakistani Rupee", currencyCode: "PKR",
    timezone: "Asia/Karachi",
    stateLabel: "Province",
    states: ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Gilgit-Baltistan", "Azad Kashmir", "Islamabad Capital Territory", "FATA"],
  },
  {
    name: "United States", code: "US",
    currency: "USD - US Dollar", currencyCode: "USD",
    timezone: "America/New_York",
    stateLabel: "State",
    states: [
      "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
      "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
      "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
      "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
      "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
      "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
      "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
      "Wisconsin","Wyoming","Washington D.C.",
    ],
  },
  {
    name: "United Kingdom", code: "GB",
    currency: "GBP - British Pound", currencyCode: "GBP",
    timezone: "Europe/London",
    stateLabel: "Region",
    states: ["England", "Scotland", "Wales", "Northern Ireland"],
  },
  {
    name: "India", code: "IN",
    currency: "INR - Indian Rupee", currencyCode: "INR",
    timezone: "Asia/Kolkata",
    stateLabel: "State",
    states: [
      "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
      "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
      "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
      "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
      "Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu & Kashmir","Ladakh",
    ],
  },
  {
    name: "Canada", code: "CA",
    currency: "CAD - Canadian Dollar", currencyCode: "CAD",
    timezone: "America/Toronto",
    stateLabel: "Province",
    states: [
      "Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador",
      "Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island",
      "Quebec","Saskatchewan","Yukon",
    ],
  },
  {
    name: "Australia", code: "AU",
    currency: "AUD - Australian Dollar", currencyCode: "AUD",
    timezone: "Australia/Sydney",
    stateLabel: "State",
    states: ["New South Wales","Victoria","Queensland","Western Australia","South Australia","Tasmania","ACT","Northern Territory"],
  },
  {
    name: "Germany", code: "DE",
    currency: "EUR - Euro", currencyCode: "EUR",
    timezone: "Europe/Berlin",
    stateLabel: "State",
    states: ["Baden-Württemberg","Bavaria","Berlin","Brandenburg","Bremen","Hamburg","Hesse","Lower Saxony","Mecklenburg-Vorpommern","North Rhine-Westphalia","Rhineland-Palatinate","Saarland","Saxony","Saxony-Anhalt","Schleswig-Holstein","Thuringia"],
  },
  {
    name: "France", code: "FR",
    currency: "EUR - Euro", currencyCode: "EUR",
    timezone: "Europe/Paris",
    stateLabel: "Region",
    states: ["Auvergne-Rhône-Alpes","Bourgogne-Franche-Comté","Bretagne","Centre-Val de Loire","Corse","Grand Est","Hauts-de-France","Île-de-France","Normandie","Nouvelle-Aquitaine","Occitanie","Pays de la Loire","Provence-Alpes-Côte d'Azur"],
  },
  {
    name: "Qatar", code: "QA",
    currency: "QAR - Qatari Riyal", currencyCode: "QAR",
    timezone: "Asia/Qatar",
    stateLabel: "Municipality",
    states: ["Ad Dawhah (Doha)","Al Khawr","Al Rayyan","Al Shahaniyah","Al Shamal","Al Wakrah","Ash Shahaniyah","Umm Salal"],
  },
  {
    name: "Kuwait", code: "KW",
    currency: "KWD - Kuwaiti Dinar", currencyCode: "KWD",
    timezone: "Asia/Kuwait",
    stateLabel: "Governorate",
    states: ["Al Asimah","Hawalli","Farwaniyah","Ahmadi","Jahra","Mubarak Al-Kabeer"],
  },
  {
    name: "Bahrain", code: "BH",
    currency: "BHD - Bahraini Dinar", currencyCode: "BHD",
    timezone: "Asia/Bahrain",
    stateLabel: "Governorate",
    states: ["Capital","Northern","Southern","Muharraq"],
  },
  {
    name: "Oman", code: "OM",
    currency: "OMR - Omani Rial", currencyCode: "OMR",
    timezone: "Asia/Muscat",
    stateLabel: "Governorate",
    states: ["Muscat","Dhofar","Musandam","Al Buraymi","Ad Dakhiliyah","Al Batinah North","Al Batinah South","Al Sharqiyah North","Al Sharqiyah South","Ad Dhahirah","Al Wusta"],
  },
  {
    name: "Jordan", code: "JO",
    currency: "JOD - Jordanian Dinar", currencyCode: "JOD",
    timezone: "Asia/Amman",
    stateLabel: "Governorate",
    states: ["Amman","Balqa","Zarqa","Madaba","Irbid","Mafraq","Jerash","Ajloun","Karak","Tafilah","Ma'an","Aqaba"],
  },
  {
    name: "Egypt", code: "EG",
    currency: "EGP - Egyptian Pound", currencyCode: "EGP",
    timezone: "Africa/Cairo",
    stateLabel: "Governorate",
    states: ["Cairo","Alexandria","Giza","Qalyubia","Port Said","Suez","Dakahlia","Sharkia","Kafr El Sheikh","Gharbia","Monufia","Beheira","Ismailia","Bani Sweif","Faiyum","Minya","Asyut","Sohag","Qena","Aswan","Luxor","Red Sea","New Valley","Matrouh","North Sinai","South Sinai","Damietta"],
  },
  {
    name: "Singapore", code: "SG",
    currency: "SGD - Singapore Dollar", currencyCode: "SGD",
    timezone: "Asia/Singapore",
    stateLabel: "Region",
    states: ["Central Region","East Region","North Region","North-East Region","West Region"],
  },
  {
    name: "Malaysia", code: "MY",
    currency: "MYR - Malaysian Ringgit", currencyCode: "MYR",
    timezone: "Asia/Kuala_Lumpur",
    stateLabel: "State",
    states: ["Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Penang","Perak","Perlis","Sabah","Sarawak","Selangor","Terengganu","Kuala Lumpur","Labuan","Putrajaya"],
  },
  {
    name: "Turkey", code: "TR",
    currency: "TRY - Turkish Lira", currencyCode: "TRY",
    timezone: "Europe/Istanbul",
    stateLabel: "Province",
    states: ["Istanbul","Ankara","Izmir","Bursa","Adana","Gaziantep","Konya","Antalya","Kayseri","Mersin","Diyarbakır","Kocaeli","Eskişehir","Şanlıurfa","Trabzon"],
  },
  {
    name: "Nigeria", code: "NG",
    currency: "NGN - Nigerian Naira", currencyCode: "NGN",
    timezone: "Africa/Lagos",
    stateLabel: "State",
    states: ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT Abuja","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"],
  },
  {
    name: "South Africa", code: "ZA",
    currency: "ZAR - South African Rand", currencyCode: "ZAR",
    timezone: "Africa/Johannesburg",
    stateLabel: "Province",
    states: ["Eastern Cape","Free State","Gauteng","KwaZulu-Natal","Limpopo","Mpumalanga","Northern Cape","North West","Western Cape"],
  },
];

export const INDUSTRIES = [
  "All Industries",
  "Retail & E-Commerce",
  "Real Estate",
  "Construction",
  "Hospitality & Tourism",
  "Healthcare",
  "Education",
  "Manufacturing",
  "Finance & Banking",
  "Logistics & Supply Chain",
  "Food & Beverage",
  "Technology & IT",
  "Wholesale & Distribution",
  "Professional Services",
  "Agriculture",
  "Other",
];

export const LANGUAGES = [
  "English", "Arabic", "French", "German", "Spanish",
  "Urdu", "Hindi", "Turkish", "Malay", "Indonesian",
  "Portuguese", "Dutch", "Italian", "Russian", "Chinese (Simplified)",
];

export const FISCAL_YEARS = [
  "January - December",
  "April - March",
  "July - June",
  "October - September",
];

export function getTimezoneLabel(tz: string): string {
  try {
    const now = new Date();
    const offset = -now.getTimezoneOffset();
    const fmt = Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "long" })
      .formatToParts(now)
      .find(p => p.type === "timeZoneName")?.value ?? tz;
    const h = Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0");
    const m = (Math.abs(offset) % 60).toString().padStart(2, "0");
    const sign = offset >= 0 ? "+" : "-";
    // Get real UTC offset for the chosen timezone
    const tzOffset = getUtcOffset(tz);
    return `(GMT ${tzOffset}) ${fmt} (${tz})`;
  } catch {
    return tz;
  }
}

export function getUtcOffset(tz: string): string {
  try {
    const now = new Date();
    const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const diff = (local.getTime() - utc.getTime()) / 60000;
    const h = Math.floor(Math.abs(diff) / 60).toString().padStart(2, "0");
    const m = (Math.abs(diff) % 60).toString().padStart(2, "0");
    const sign = diff >= 0 ? "+" : "-";
    return `${sign}${h}:${m}`;
  } catch {
    return "+00:00";
  }
}
