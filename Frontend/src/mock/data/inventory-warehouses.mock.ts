export type WarehouseType = "main" | "transit" | "cold_storage" | "bonded";
export type WarehouseStatus = "active" | "inactive";

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
  location: {
    city: string;
    address: string;
  };
  manager: string;
  managerPhone: string;
  managerEmail: string;
  capacity: number; // sqm
  utilized: number; // sqm
  utilizationPct: number;
  status: WarehouseStatus;
  zones: string[];
  totalSKUs: number;
  totalValue: number;
  lastAudit: string;
  nextAudit: string;
}

export const warehouses: Warehouse[] = [
  {
    id: "wh-001",
    code: "DXB-MAIN",
    name: "Dubai Main Warehouse",
    type: "main",
    location: {
      city: "Dubai",
      address: "Jebel Ali Free Zone, Plot WH-14, Dubai, UAE",
    },
    manager: "Khalid Al Rashidi",
    managerPhone: "+971 50 123 4567",
    managerEmail: "k.rashidi@softaxis.ae",
    capacity: 5000,
    utilized: 3900,
    utilizationPct: 78,
    status: "active",
    zones: ["Zone A - General", "Zone B - Electronics", "Zone C - Heavy Items", "Zone D - Returns"],
    totalSKUs: 842,
    totalValue: 4820000,
    lastAudit: "2026-03-15",
    nextAudit: "2026-06-15",
  },
  {
    id: "wh-002",
    code: "AUH-BRANCH",
    name: "Abu Dhabi Branch Warehouse",
    type: "main",
    location: {
      city: "Abu Dhabi",
      address: "ICAD II, Mussafah Industrial Area, Abu Dhabi, UAE",
    },
    manager: "Fatima Al Mansoori",
    managerPhone: "+971 55 987 6543",
    managerEmail: "f.mansoori@softaxis.ae",
    capacity: 2000,
    utilized: 1340,
    utilizationPct: 67,
    status: "active",
    zones: ["Zone A - General", "Zone B - Office Equipment", "Zone C - Networking"],
    totalSKUs: 356,
    totalValue: 1950000,
    lastAudit: "2026-02-20",
    nextAudit: "2026-05-20",
  },
  {
    id: "wh-003",
    code: "SHJ-TRANSIT",
    name: "Sharjah Transit Hub",
    type: "transit",
    location: {
      city: "Sharjah",
      address: "Hamriyah Free Zone, Block 3, Sharjah, UAE",
    },
    manager: "Mohammed Al Hammadi",
    managerPhone: "+971 56 234 5678",
    managerEmail: "m.hammadi@softaxis.ae",
    capacity: 1500,
    utilized: 675,
    utilizationPct: 45,
    status: "active",
    zones: ["Inbound Bay", "Outbound Bay", "Staging Area"],
    totalSKUs: 128,
    totalValue: 620000,
    lastAudit: "2026-04-01",
    nextAudit: "2026-07-01",
  },
  {
    id: "wh-004",
    code: "DXB-COLD",
    name: "Dubai Cold Store Facility",
    type: "cold_storage",
    location: {
      city: "Dubai",
      address: "Al Quoz Industrial Area 4, Dubai, UAE",
    },
    manager: "Priya Nair",
    managerPhone: "+971 52 345 6789",
    managerEmail: "p.nair@softaxis.ae",
    capacity: 800,
    utilized: 680,
    utilizationPct: 85,
    status: "active",
    zones: ["Chilled Zone (-2°C to 4°C)", "Frozen Zone (-18°C to -22°C)"],
    totalSKUs: 64,
    totalValue: 890000,
    lastAudit: "2026-04-10",
    nextAudit: "2026-07-10",
  },
  {
    id: "wh-005",
    code: "DXB-BONDED",
    name: "Dubai Bonded Warehouse",
    type: "bonded",
    location: {
      city: "Dubai",
      address: "Dubai International Airport Free Zone (DAFZA), Dubai, UAE",
    },
    manager: "Tariq Siddiqui",
    managerPhone: "+971 50 456 7890",
    managerEmail: "t.siddiqui@softaxis.ae",
    capacity: 1200,
    utilized: 504,
    utilizationPct: 42,
    status: "active",
    zones: ["Bonded Storage A", "Bonded Storage B", "Customs Hold"],
    totalSKUs: 97,
    totalValue: 2340000,
    lastAudit: "2026-03-25",
    nextAudit: "2026-06-25",
  },
];

export const warehousesSummary = {
  total: warehouses.length,
  active: warehouses.filter((w) => w.status === "active").length,
  totalCapacity: warehouses.reduce((s, w) => s + w.capacity, 0),
  totalUtilized: warehouses.reduce((s, w) => s + w.utilized, 0),
  avgUtilization: Math.round(
    warehouses.reduce((s, w) => s + w.utilizationPct, 0) / warehouses.length
  ),
  totalSKUs: warehouses.reduce((s, w) => s + w.totalSKUs, 0),
  totalValue: warehouses.reduce((s, w) => s + w.totalValue, 0),
};
