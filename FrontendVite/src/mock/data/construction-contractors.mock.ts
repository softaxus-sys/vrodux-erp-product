export type ContractorTrade =
  | "civil"
  | "mep"
  | "structural"
  | "finishing"
  | "landscaping"
  | "hvac"
  | "electrical"
  | "plumbing"
  | "it_infra"
  | "safety";

export type ContractorStatus = "active" | "inactive" | "blacklisted";

export interface Contractor {
  id: string;
  contractorCode: string;
  companyName: string;
  tradeName: string;
  trade: ContractorTrade[];
  status: ContractorStatus;
  rating: number; // 1-5
  contactPerson: string;
  email: string;
  phone: string;
  location: {
    city: string;
    country: string;
  };
  licenseNumber: string;
  licenseExpiry: string;
  insurance: {
    provider: string;
    expiry: string;
    covered: string;
  };
  activeProjects: number;
  completedProjects: number;
  totalContractValue: number;
  notes: string;
}

export const contractors: Contractor[] = [
  {
    id: "con-001",
    contractorCode: "CON-HAB-001",
    companyName: "Al Habtoor Civil Works LLC",
    tradeName: "Al Habtoor Civil",
    trade: ["civil", "structural"],
    status: "active",
    rating: 4.5,
    contactPerson: "Eng. Walid Al Habtoor",
    email: "walid@alhabtoor-civil.ae",
    phone: "+971 4 447 1234",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-CONT-2020-00142",
    licenseExpiry: "2026-12-31",
    insurance: {
      provider: "AXA Gulf",
      expiry: "2026-12-31",
      covered: "AED 50,000,000",
    },
    activeProjects: 3,
    completedProjects: 24,
    totalContractValue: 182000000,
    notes: "Tier 1 civil contractor. Preferred vendor for large-scale projects.",
  },
  {
    id: "con-002",
    contractorCode: "CON-ETA-002",
    companyName: "ETA Melco Engineering LLC",
    tradeName: "ETA Melco",
    trade: ["mep", "electrical", "plumbing"],
    status: "active",
    rating: 4.2,
    contactPerson: "Mr. George Mathew",
    email: "g.mathew@eta-melco.ae",
    phone: "+971 4 883 2200",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-MECH-2019-00088",
    licenseExpiry: "2026-09-30",
    insurance: {
      provider: "RSA Insurance",
      expiry: "2026-09-30",
      covered: "AED 30,000,000",
    },
    activeProjects: 4,
    completedProjects: 38,
    totalContractValue: 124000000,
    notes: "Strong MEP capability. DEWA-approved electrical contractor.",
  },
  {
    id: "con-003",
    contractorCode: "CON-ARC-003",
    companyName: "Arabian Construction Company (ACC UAE)",
    tradeName: "ACC UAE",
    trade: ["civil", "structural", "finishing"],
    status: "active",
    rating: 4.8,
    contactPerson: "Eng. Fadi Mansour",
    email: "fadi.mansour@acc-uae.com",
    phone: "+971 2 681 5500",
    location: { city: "Abu Dhabi", country: "UAE" },
    licenseNumber: "ADM-CONT-2018-00056",
    licenseExpiry: "2027-03-31",
    insurance: {
      provider: "Zurich Insurance",
      expiry: "2027-03-31",
      covered: "AED 100,000,000",
    },
    activeProjects: 2,
    completedProjects: 41,
    totalContractValue: 320000000,
    notes: "Top-tier contractor. Specialises in high-rise and complex structures.",
  },
  {
    id: "con-004",
    contractorCode: "CON-DRS-004",
    companyName: "Drake & Scull International",
    tradeName: "Drake & Scull",
    trade: ["hvac", "mep"],
    status: "active",
    rating: 3.9,
    contactPerson: "Mr. Sameer Shafique",
    email: "s.shafique@drakescull.ae",
    phone: "+971 4 246 8000",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-MECH-2017-00034",
    licenseExpiry: "2026-07-15",
    insurance: {
      provider: "AIG UAE",
      expiry: "2026-07-15",
      covered: "AED 25,000,000",
    },
    activeProjects: 1,
    completedProjects: 52,
    totalContractValue: 245000000,
    notes: "License renewal due in 56 days. Performance on recent projects is adequate.",
  },
  {
    id: "con-005",
    contractorCode: "CON-BLG-005",
    companyName: "Saudi Binladin Group (UAE Branch)",
    tradeName: "Binladin Group UAE",
    trade: ["civil", "structural", "mep"],
    status: "active",
    rating: 4.6,
    contactPerson: "Eng. Abdullah Al Ghamdi",
    email: "a.ghamdi@sbg-uae.com",
    phone: "+971 2 443 7700",
    location: { city: "Abu Dhabi", country: "UAE" },
    licenseNumber: "ADM-CONT-2016-00021",
    licenseExpiry: "2027-06-30",
    insurance: {
      provider: "AXA Gulf",
      expiry: "2027-06-30",
      covered: "AED 200,000,000",
    },
    activeProjects: 2,
    completedProjects: 67,
    totalContractValue: 580000000,
    notes: "Largest contractor by contract value. Reliable on mega projects.",
  },
  {
    id: "con-006",
    contractorCode: "CON-ALB-006",
    companyName: "Archirodon Construction Ltd",
    tradeName: "Archirodon",
    trade: ["civil", "structural"],
    status: "active",
    rating: 4.3,
    contactPerson: "Mr. Nikos Papadopoulos",
    email: "n.papadopoulos@archirodon.ae",
    phone: "+971 2 673 4100",
    location: { city: "Abu Dhabi", country: "UAE" },
    licenseNumber: "ADM-CONT-2019-00078",
    licenseExpiry: "2026-11-30",
    insurance: {
      provider: "Allianz SE",
      expiry: "2026-11-30",
      covered: "AED 75,000,000",
    },
    activeProjects: 1,
    completedProjects: 29,
    totalContractValue: 195000000,
    notes: "Specialises in marine and infrastructure works.",
  },
  {
    id: "con-007",
    contractorCode: "CON-KAL-007",
    companyName: "Khatib & Alami — UAE",
    tradeName: "Khatib & Alami",
    trade: ["civil", "landscaping"],
    status: "active",
    rating: 4.1,
    contactPerson: "Eng. Rami Khalil",
    email: "r.khalil@khatib-alami.ae",
    phone: "+971 4 393 3500",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-CONT-2021-00215",
    licenseExpiry: "2026-06-10",
    insurance: {
      provider: "Orient Insurance",
      expiry: "2026-06-10",
      covered: "AED 20,000,000",
    },
    activeProjects: 2,
    completedProjects: 18,
    totalContractValue: 62000000,
    notes: "License expiring in 21 days — renewal in progress per contractor.",
  },
  {
    id: "con-008",
    contractorCode: "CON-TEC-008",
    companyName: "UAE TECOM IT Infrastructure LLC",
    tradeName: "TECOM IT",
    trade: ["it_infra", "electrical"],
    status: "active",
    rating: 4.4,
    contactPerson: "Mr. Rahul Sharma",
    email: "r.sharma@tecom-it.ae",
    phone: "+971 4 360 7000",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-IT-2022-00098",
    licenseExpiry: "2027-01-31",
    insurance: {
      provider: "MetLife AIG",
      expiry: "2027-01-31",
      covered: "AED 15,000,000",
    },
    activeProjects: 3,
    completedProjects: 12,
    totalContractValue: 48000000,
    notes: "Certified Cisco, HPE, and Schneider Electric partner.",
  },
  {
    id: "con-009",
    contractorCode: "CON-ALR-009",
    companyName: "Al Shirawi Contracting Co LLC",
    tradeName: "Al Shirawi",
    trade: ["mep", "hvac", "plumbing"],
    status: "active",
    rating: 4.0,
    contactPerson: "Mr. Thomas Varghese",
    email: "t.varghese@alshirawi.ae",
    phone: "+971 4 884 5100",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-MECH-2020-00176",
    licenseExpiry: "2026-10-15",
    insurance: {
      provider: "RSA Insurance",
      expiry: "2026-10-15",
      covered: "AED 20,000,000",
    },
    activeProjects: 2,
    completedProjects: 33,
    totalContractValue: 88000000,
    notes: "Reliable MEP contractor for mid-size projects.",
  },
  {
    id: "con-010",
    contractorCode: "CON-GPS-010",
    companyName: "Gulf Precast Concrete LLC",
    tradeName: "Gulf Precast",
    trade: ["structural"],
    status: "active",
    rating: 4.3,
    contactPerson: "Eng. Hassan Al Mutawa",
    email: "h.mutawa@gulfprecast.ae",
    phone: "+971 6 526 3300",
    location: { city: "Sharjah", country: "UAE" },
    licenseNumber: "SEDD-CONT-2019-00089",
    licenseExpiry: "2026-08-31",
    insurance: {
      provider: "Oman Insurance",
      expiry: "2026-08-31",
      covered: "AED 30,000,000",
    },
    activeProjects: 2,
    completedProjects: 22,
    totalContractValue: 95000000,
    notes: "Specialist precast and prestressed concrete supplier and installer.",
  },
  {
    id: "con-011",
    contractorCode: "CON-ART-011",
    companyName: "Arabtec Finishing LLC",
    tradeName: "Arabtec Finishing",
    trade: ["finishing", "landscaping"],
    status: "inactive",
    rating: 3.2,
    contactPerson: "Mr. Ibrahim Al Sayed",
    email: "i.sayed@arabtec-fin.ae",
    phone: "+971 4 441 6000",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-FIN-2018-00067",
    licenseExpiry: "2025-12-31",
    insurance: {
      provider: "GIG Gulf",
      expiry: "2025-12-31",
      covered: "AED 10,000,000",
    },
    activeProjects: 0,
    completedProjects: 45,
    totalContractValue: 68000000,
    notes: "Inactive — license expired. Under review for reactivation.",
  },
  {
    id: "con-012",
    contractorCode: "CON-BLD-012",
    companyName: "ProSafe Construction Services LLC",
    tradeName: "ProSafe",
    trade: ["safety", "civil"],
    status: "blacklisted",
    rating: 1.5,
    contactPerson: "Mr. Viktor Petrov",
    email: "v.petrov@prosafe-uae.ae",
    phone: "+971 4 237 0000",
    location: { city: "Dubai", country: "UAE" },
    licenseNumber: "DM-CONT-2021-00302",
    licenseExpiry: "2026-03-31",
    insurance: {
      provider: "None",
      expiry: "N/A",
      covered: "N/A",
    },
    activeProjects: 0,
    completedProjects: 5,
    totalContractValue: 8500000,
    notes: "Blacklisted — multiple safety violations, late deliveries, and contract disputes. Do not engage.",
  },
];

export const contractorsSummary = {
  total: contractors.length,
  active: contractors.filter((c) => c.status === "active").length,
  inactive: contractors.filter((c) => c.status === "inactive").length,
  blacklisted: contractors.filter((c) => c.status === "blacklisted").length,
  avgRating: parseFloat(
    (contractors.filter((c) => c.status === "active").reduce((s, c) => s + c.rating, 0) /
      contractors.filter((c) => c.status === "active").length).toFixed(1)
  ),
  totalContractValue: contractors.reduce((s, c) => s + c.totalContractValue, 0),
};
