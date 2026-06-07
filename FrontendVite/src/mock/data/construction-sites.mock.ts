export type SiteStatus = "active" | "inactive" | "completed";

export interface Site {
  id: string;
  siteCode: string;
  name: string;
  projectId: string;
  projectName: string;
  location: {
    address: string;
    city: string;
    emirate: string;
    lat: string;
    lng: string;
  };
  siteManager: string;
  siteManagerPhone: string;
  safetyOfficer: string;
  safetyOfficerPhone: string;
  status: SiteStatus;
  workers: {
    current: number;
    max: number;
  };
  area: number; // sqm
  startDate: string;
  permitNumber: string;
  permitExpiry: string;
  lastInspection: string;
  nextInspection: string;
  safetyScore: number; // 0-100
  notes: string;
}

export const sites: Site[] = [
  {
    id: "site-001",
    siteCode: "SITE-DXB-001",
    name: "Palm Jumeirah Villa Complex Site",
    projectId: "proj-001",
    projectName: "Luxury Villa Complex",
    location: {
      address: "Frond K, Palm Jumeirah",
      city: "Dubai",
      emirate: "Dubai",
      lat: "25.1124",
      lng: "55.1390",
    },
    siteManager: "Eng. Pradeep Nambiar",
    siteManagerPhone: "+971 50 112 3344",
    safetyOfficer: "James Okafor",
    safetyOfficerPhone: "+971 55 334 5566",
    status: "active",
    workers: { current: 340, max: 450 },
    area: 42000,
    startDate: "2024-03-01",
    permitNumber: "DM-2024-BLD-00412",
    permitExpiry: "2026-08-31",
    lastInspection: "2026-05-01",
    nextInspection: "2026-06-01",
    safetyScore: 88,
    notes: "24 villa plots. Heavy equipment access via north gate only.",
  },
  {
    id: "site-002",
    siteCode: "SITE-DXB-002",
    name: "Business Bay Tower Site",
    projectId: "proj-002",
    projectName: "Commercial Tower — Business Bay",
    location: {
      address: "Plot BB-204, Business Bay",
      city: "Dubai",
      emirate: "Dubai",
      lat: "25.1850",
      lng: "55.2620",
    },
    siteManager: "Eng. Ramesh Subramaniam",
    siteManagerPhone: "+971 50 223 4455",
    safetyOfficer: "Mohammed Abdel Aziz",
    safetyOfficerPhone: "+971 55 445 6677",
    status: "active",
    workers: { current: 680, max: 900 },
    area: 8500,
    startDate: "2024-06-01",
    permitNumber: "DM-2024-BLD-00718",
    permitExpiry: "2027-05-31",
    lastInspection: "2026-05-10",
    nextInspection: "2026-06-10",
    safetyScore: 82,
    notes: "Tower crane TC-01 and TC-02 operational. Night works permit active.",
  },
  {
    id: "site-003",
    siteCode: "SITE-AUH-001",
    name: "Ring Road Expansion Site",
    projectId: "proj-003",
    projectName: "Abu Dhabi Ring Road Expansion",
    location: {
      address: "E10 Ring Road, Sector 14",
      city: "Abu Dhabi",
      emirate: "Abu Dhabi",
      lat: "24.4539",
      lng: "54.3773",
    },
    siteManager: "Eng. Vijay Krishnamurthy",
    siteManagerPhone: "+971 50 334 5566",
    safetyOfficer: "Ali Hassan Al Balushi",
    safetyOfficerPhone: "+971 55 556 7788",
    status: "active",
    workers: { current: 520, max: 650 },
    area: 180000,
    startDate: "2023-09-01",
    permitNumber: "ADM-2023-INF-00128",
    permitExpiry: "2026-06-30",
    lastInspection: "2026-05-05",
    nextInspection: "2026-05-25",
    safetyScore: 91,
    notes: "18km linear site. Multiple active work zones. Traffic management plan in force.",
  },
  {
    id: "site-004",
    siteCode: "SITE-AUH-002",
    name: "KIZAD Warehouse Complex Site",
    projectId: "proj-004",
    projectName: "KIZAD Industrial Warehouse Complex",
    location: {
      address: "Zone A, KIZAD Industrial City",
      city: "Abu Dhabi",
      emirate: "Abu Dhabi",
      lat: "24.3506",
      lng: "54.5118",
    },
    siteManager: "Eng. Suresh Menon",
    siteManagerPhone: "+971 50 445 6677",
    safetyOfficer: "Rajan Pillai",
    safetyOfficerPhone: "+971 55 667 8899",
    status: "active",
    workers: { current: 290, max: 380 },
    area: 55000,
    startDate: "2025-01-15",
    permitNumber: "KIZAD-2025-BLD-00045",
    permitExpiry: "2026-10-31",
    lastInspection: "2026-05-08",
    nextInspection: "2026-06-08",
    safetyScore: 85,
    notes: "Steel erection in progress for Units 3-6. Bolt torquing inspection due.",
  },
  {
    id: "site-005",
    siteCode: "SITE-DXB-003",
    name: "JBR Hotel Renovation Site",
    projectId: "proj-005",
    projectName: "JBR Hotel Renovation",
    location: {
      address: "Block 2, Jumeirah Beach Residence",
      city: "Dubai",
      emirate: "Dubai",
      lat: "25.0772",
      lng: "55.1330",
    },
    siteManager: "Eng. Anwar Ibrahim",
    siteManagerPhone: "+971 50 556 7788",
    safetyOfficer: "Blessing Okonkwo",
    safetyOfficerPhone: "+971 55 778 9900",
    status: "inactive",
    workers: { current: 0, max: 200 },
    area: 12000,
    startDate: "2025-03-01",
    permitNumber: "DM-2025-REN-00214",
    permitExpiry: "2026-04-30",
    lastInspection: "2026-03-15",
    nextInspection: "2026-06-15",
    safetyScore: 76,
    notes: "Site on hold. Permit expires soon — renewal required before resuming work.",
  },
  {
    id: "site-006",
    siteCode: "SITE-DXB-004",
    name: "Dubai Creek Harbour Site",
    projectId: "proj-006",
    projectName: "Dubai Creek Mixed-Use Development",
    location: {
      address: "Parcel 4C, Dubai Creek Harbour",
      city: "Dubai",
      emirate: "Dubai",
      lat: "25.2048",
      lng: "55.3708",
    },
    siteManager: "Eng. Khalifa Al Marzouqi",
    siteManagerPhone: "+971 50 667 8899",
    safetyOfficer: "TBD",
    safetyOfficerPhone: "TBD",
    status: "inactive",
    workers: { current: 0, max: 1200 },
    area: 28000,
    startDate: "2026-09-01",
    permitNumber: "PENDING",
    permitExpiry: "2026-12-31",
    lastInspection: "N/A",
    nextInspection: "2026-09-15",
    safetyScore: 0,
    notes: "Pre-mobilisation phase. Site hoarding to be erected September 2026.",
  },
  {
    id: "site-007",
    siteCode: "SITE-SHJ-001",
    name: "Al Majaz School Site",
    projectId: "proj-007",
    projectName: "Sharjah Model School",
    location: {
      address: "Plot 22, Al Majaz 2",
      city: "Sharjah",
      emirate: "Sharjah",
      lat: "25.3513",
      lng: "55.3870",
    },
    siteManager: "Eng. Thomas George",
    siteManagerPhone: "+971 50 778 9900",
    safetyOfficer: "Gopakumar Pillai",
    safetyOfficerPhone: "+971 55 889 0011",
    status: "completed",
    workers: { current: 0, max: 280 },
    area: 14500,
    startDate: "2023-06-01",
    permitNumber: "SEDD-2023-BLD-00336",
    permitExpiry: "2025-09-30",
    lastInspection: "2025-08-20",
    nextInspection: "N/A",
    safetyScore: 96,
    notes: "Project completed. Site demobilised August 2025. Defects liability period active.",
  },
  {
    id: "site-008",
    siteCode: "SITE-DXB-005",
    name: "Dubai South Data Centre Site",
    projectId: "proj-008",
    projectName: "Dubai South Data Centre",
    location: {
      address: "Logistics District, Dubai South",
      city: "Dubai",
      emirate: "Dubai",
      lat: "24.8975",
      lng: "55.1562",
    },
    siteManager: "Eng. Deepak Sharma",
    siteManagerPhone: "+971 50 889 0011",
    safetyOfficer: "Mohammed Al Shehhi",
    safetyOfficerPhone: "+971 55 990 1122",
    status: "active",
    workers: { current: 420, max: 600 },
    area: 25000,
    startDate: "2025-05-01",
    permitNumber: "DS-2025-BLD-00088",
    permitExpiry: "2026-05-28",
    lastInspection: "2026-05-12",
    nextInspection: "2026-06-12",
    safetyScore: 89,
    notes: "Critical infrastructure site. Strict security protocols. Background checks mandatory.",
  },
];

export const sitesSummary = {
  total: sites.length,
  active: sites.filter((s) => s.status === "active").length,
  inactive: sites.filter((s) => s.status === "inactive").length,
  completed: sites.filter((s) => s.status === "completed").length,
  totalWorkers: sites.reduce((s, site) => s + site.workers.current, 0),
  avgSafetyScore: Math.round(
    sites.filter((s) => s.safetyScore > 0).reduce((sum, s) => sum + s.safetyScore, 0) /
      sites.filter((s) => s.safetyScore > 0).length
  ),
  permitsExpiringSoon: sites.filter((s) => {
    if (s.status === "completed" || s.permitExpiry === "PENDING" || s.permitExpiry === "2026-12-31") return false;
    const expiry = new Date(s.permitExpiry);
    const today = new Date("2026-05-20");
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30;
  }).length,
};
