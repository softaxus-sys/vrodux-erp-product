export type BOQStatus = "draft" | "approved" | "in_progress" | "completed";

export interface BOQItem {
  id: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  completedQty: number;
  completedAmt: number;
  variationQty: number;
  variationAmt: number;
}

export interface BOQ {
  id: string;
  boqNumber: string;
  projectId: string;
  projectName: string;
  status: BOQStatus;
  approvedBy: string | null;
  approvedDate: string | null;
  items: BOQItem[];
  totalAmount: number;
  completedAmount: number;
  variationAmount: number;
  finalAmount: number;
  completionPct: number;
}

export const boqs: BOQ[] = [
  {
    id: "boq-001",
    boqNumber: "BOQ-2024-001",
    projectId: "proj-001",
    projectName: "Luxury Villa Complex",
    status: "in_progress",
    approvedBy: "Eng. Hamad Al Falasi",
    approvedDate: "2024-03-10",
    totalAmount: 85000000,
    completedAmount: 52750000,
    variationAmount: 2850000,
    finalAmount: 87850000,
    completionPct: 62,
    items: [
      { id: "bi-001-01", itemCode: "A.1", description: "Excavation & Earthworks (incl. disposal)", unit: "m³", quantity: 45000, unitRate: 85, amount: 3825000, completedQty: 45000, completedAmt: 3825000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-02", itemCode: "A.2", description: "Piling — 600mm dia bored piles", unit: "m", quantity: 8200, unitRate: 680, amount: 5576000, completedQty: 8200, completedAmt: 5576000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-03", itemCode: "B.1", description: "Grade beams — supply, form, pour & cure concrete C40", unit: "m³", quantity: 3200, unitRate: 920, amount: 2944000, completedQty: 3200, completedAmt: 2944000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-04", itemCode: "B.2", description: "Reinforcement steel (high yield) — foundations", unit: "tonne", quantity: 480, unitRate: 4200, amount: 2016000, completedQty: 480, completedAmt: 2016000, variationQty: 20, variationAmt: 84000 },
      { id: "bi-001-05", itemCode: "C.1", description: "Columns & shear walls — concrete C40", unit: "m³", quantity: 2800, unitRate: 1100, amount: 3080000, completedQty: 2800, completedAmt: 3080000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-06", itemCode: "C.2", description: "Suspended slabs — concrete C35", unit: "m²", quantity: 32000, unitRate: 340, amount: 10880000, completedQty: 32000, completedAmt: 10880000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-07", itemCode: "D.1", description: "Block masonry — 200mm lightweight blocks", unit: "m²", quantity: 18000, unitRate: 185, amount: 3330000, completedQty: 18000, completedAmt: 3330000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-08", itemCode: "E.1", description: "External plastering — polymer modified", unit: "m²", quantity: 28000, unitRate: 125, amount: 3500000, completedQty: 28000, completedAmt: 3500000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-09", itemCode: "E.2", description: "Internal plastering & skim coat", unit: "m²", quantity: 45000, unitRate: 95, amount: 4275000, completedQty: 22000, completedAmt: 2090000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-10", itemCode: "F.1", description: "Marble flooring — Calacatta, 600x600mm", unit: "m²", quantity: 22000, unitRate: 480, amount: 10560000, completedQty: 8000, completedAmt: 3840000, variationQty: 500, variationAmt: 240000 },
      { id: "bi-001-11", itemCode: "G.1", description: "MEP rough-in works — all trades", unit: "sum", quantity: 1, unitRate: 12000000, amount: 12000000, completedQty: 1, completedAmt: 12000000, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-12", itemCode: "G.2", description: "HVAC — VRF system supply & installation", unit: "sum", quantity: 1, unitRate: 8500000, amount: 8500000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-13", itemCode: "H.1", description: "Aluminium doors & windows — Schuco system", unit: "m²", quantity: 4800, unitRate: 1850, amount: 8880000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-14", itemCode: "I.1", description: "Swimming pools — shell & finish, 24 units", unit: "nr", quantity: 24, unitRate: 185000, amount: 4440000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-001-15", itemCode: "J.1", description: "Landscaping & soft landscaping", unit: "sum", quantity: 1, unitRate: 1190000, amount: 1190000, completedQty: 0, completedAmt: 0, variationQty: 100000, variationAmt: 100000 },
    ],
  },
  {
    id: "boq-002",
    boqNumber: "BOQ-2024-002",
    projectId: "proj-002",
    projectName: "Commercial Tower — Business Bay",
    status: "in_progress",
    approvedBy: "Eng. Yousuf Al Khoury",
    approvedDate: "2024-06-15",
    totalAmount: 320000000,
    completedAmount: 96800000,
    variationAmount: 5400000,
    finalAmount: 325400000,
    completionPct: 30,
    items: [
      { id: "bi-002-01", itemCode: "A.1", description: "Piling — 900mm bored piles, 180 nr", unit: "m", quantity: 5400, unitRate: 1200, amount: 6480000, completedQty: 5400, completedAmt: 6480000, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-02", itemCode: "A.2", description: "Basement excavation & dewatering", unit: "m³", quantity: 85000, unitRate: 120, amount: 10200000, completedQty: 85000, completedAmt: 10200000, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-03", itemCode: "B.1", description: "Raft foundation — 2.2m thick C50 concrete", unit: "m³", quantity: 18000, unitRate: 1350, amount: 24300000, completedQty: 18000, completedAmt: 24300000, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-04", itemCode: "B.2", description: "Post-tensioned suspended slabs", unit: "m²", quantity: 98000, unitRate: 580, amount: 56840000, completedQty: 29000, completedAmt: 16820000, variationQty: 2000, variationAmt: 1160000 },
      { id: "bi-002-05", itemCode: "B.3", description: "Core walls — slip form concrete C60", unit: "m³", quantity: 12000, unitRate: 1600, amount: 19200000, completedQty: 7200, completedAmt: 11520000, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-06", itemCode: "C.1", description: "Structural steel — beams and columns", unit: "tonne", quantity: 3200, unitRate: 7500, amount: 24000000, completedQty: 800, completedAmt: 6000000, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-07", itemCode: "D.1", description: "Curtain wall facade system — unitised", unit: "m²", quantity: 32000, unitRate: 2800, amount: 89600000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-08", itemCode: "E.1", description: "MEP (all trades) — full building", unit: "sum", quantity: 1, unitRate: 55000000, amount: 55000000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-09", itemCode: "E.2", description: "BMS & ELV systems", unit: "sum", quantity: 1, unitRate: 8200000, amount: 8200000, completedQty: 0, completedAmt: 0, variationQty: 1000000, variationAmt: 1000000 },
      { id: "bi-002-10", itemCode: "F.1", description: "Fit-out — office floors 1-35", unit: "m²", quantity: 62000, unitRate: 2200, amount: 136400000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-11", itemCode: "F.2", description: "Retail podium fit-out", unit: "m²", quantity: 4000, unitRate: 3500, amount: 14000000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-002-12", itemCode: "G.1", description: "Provisional sums & contingencies", unit: "sum", quantity: 1, unitRate: 16780000, amount: 16780000, completedQty: 0, completedAmt: 0, variationQty: 3240000, variationAmt: 3240000 },
    ],
  },
  {
    id: "boq-003",
    boqNumber: "BOQ-2023-003",
    projectId: "proj-003",
    projectName: "Abu Dhabi Ring Road Expansion",
    status: "in_progress",
    approvedBy: "Eng. Sultan Al Dhaheri",
    approvedDate: "2023-09-15",
    totalAmount: 145000000,
    completedAmount: 118200000,
    variationAmount: 4200000,
    finalAmount: 149200000,
    completionPct: 81,
    items: [
      { id: "bi-003-01", itemCode: "A.1", description: "Clearing & grubbing, 18km corridor", unit: "ha", quantity: 54, unitRate: 45000, amount: 2430000, completedQty: 54, completedAmt: 2430000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-02", itemCode: "A.2", description: "Bulk earthworks & grading", unit: "m³", quantity: 850000, unitRate: 28, amount: 23800000, completedQty: 850000, completedAmt: 23800000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-03", itemCode: "B.1", description: "Drainage pipes — 450mm–1200mm RCCP", unit: "m", quantity: 12400, unitRate: 650, amount: 8060000, completedQty: 12400, completedAmt: 8060000, variationQty: 600, variationAmt: 390000 },
      { id: "bi-003-04", itemCode: "B.2", description: "Box culverts — 3x3m precast", unit: "m", quantity: 380, unitRate: 4800, amount: 1824000, completedQty: 380, completedAmt: 1824000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-05", itemCode: "C.1", description: "Sub-base — 300mm granular, CBR>80", unit: "m²", quantity: 280000, unitRate: 55, amount: 15400000, completedQty: 280000, completedAmt: 15400000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-06", itemCode: "C.2", description: "Asphalt base course — 80mm dense bitumen macadam", unit: "tonne", quantity: 62000, unitRate: 420, amount: 26040000, completedQty: 62000, completedAmt: 26040000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-07", itemCode: "C.3", description: "Asphalt wearing course — 50mm SMA", unit: "tonne", quantity: 38000, unitRate: 480, amount: 18240000, completedQty: 38000, completedAmt: 18240000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-08", itemCode: "D.1", description: "Bridges — 5 nr, PC beam & in-situ deck", unit: "sum", quantity: 1, unitRate: 28000000, amount: 28000000, completedQty: 0, completedAmt: 0, variationQty: 2200000, variationAmt: 2200000 },
      { id: "bi-003-09", itemCode: "E.1", description: "Road markings & signage — full scheme", unit: "sum", quantity: 1, unitRate: 4200000, amount: 4200000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-10", itemCode: "E.2", description: "Crash barriers — W-beam galvanised", unit: "m", quantity: 36000, unitRate: 185, amount: 6660000, completedQty: 22000, completedAmt: 4070000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-11", itemCode: "F.1", description: "Street lighting — poles and LED luminaires", unit: "nr", quantity: 1200, unitRate: 4800, amount: 5760000, completedQty: 800, completedAmt: 3840000, variationQty: 0, variationAmt: 0 },
      { id: "bi-003-12", itemCode: "G.1", description: "Landscaping — median and verge planting", unit: "m²", quantity: 45000, unitRate: 85, amount: 3825000, completedQty: 10000, completedAmt: 850000, variationQty: 1000, variationAmt: 85000 },
      { id: "bi-003-13", itemCode: "H.1", description: "Traffic signals — 4 nr intersections", unit: "nr", quantity: 4, unitRate: 380000, amount: 1520000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
    ],
  },
  {
    id: "boq-004",
    boqNumber: "BOQ-2025-004",
    projectId: "proj-004",
    projectName: "KIZAD Industrial Warehouse Complex",
    status: "approved",
    approvedBy: "Eng. Mariam Al Nuaimi",
    approvedDate: "2025-01-20",
    totalAmount: 62000000,
    completedAmount: 28600000,
    variationAmount: 800000,
    finalAmount: 62800000,
    completionPct: 46,
    items: [
      { id: "bi-004-01", itemCode: "A.1", description: "Site clearance & demolition", unit: "sum", quantity: 1, unitRate: 850000, amount: 850000, completedQty: 1, completedAmt: 850000, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-02", itemCode: "A.2", description: "Bulk earthworks & levelling", unit: "m³", quantity: 120000, unitRate: 32, amount: 3840000, completedQty: 120000, completedAmt: 3840000, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-03", itemCode: "B.1", description: "Ground improvement — vibro-compaction", unit: "m²", quantity: 55000, unitRate: 180, amount: 9900000, completedQty: 55000, completedAmt: 9900000, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-04", itemCode: "B.2", description: "Slab-on-grade — 250mm C35, fibre-reinforced", unit: "m²", quantity: 48000, unitRate: 280, amount: 13440000, completedQty: 48000, completedAmt: 13440000, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-05", itemCode: "C.1", description: "Pre-engineered steel structure — 6 units", unit: "tonne", quantity: 2800, unitRate: 6800, amount: 19040000, completedQty: 1960, completedAmt: 13328000, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-06", itemCode: "C.2", description: "Roof sheeting — insulated panel 100mm", unit: "m²", quantity: 48000, unitRate: 220, amount: 10560000, completedQty: 9600, completedAmt: 2112000, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-07", itemCode: "C.3", description: "Wall cladding — colorbond sheeting", unit: "m²", quantity: 22000, unitRate: 185, amount: 4070000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-08", itemCode: "D.1", description: "Overhead sectional doors — 5x5m, 36 nr", unit: "nr", quantity: 36, unitRate: 28000, amount: 1008000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-09", itemCode: "E.1", description: "MEP services — fire protection, electrical, plumbing", unit: "sum", quantity: 1, unitRate: 3850000, amount: 3850000, completedQty: 0, completedAmt: 0, variationQty: 800000, variationAmt: 800000 },
      { id: "bi-004-10", itemCode: "F.1", description: "External paving — 150mm stamped concrete", unit: "m²", quantity: 18000, unitRate: 160, amount: 2880000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-11", itemCode: "G.1", description: "Fencing & gates — perimeter security", unit: "m", quantity: 1800, unitRate: 850, amount: 1530000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-004-12", itemCode: "H.1", description: "Provisional sums", unit: "sum", quantity: 1, unitRate: 1032000, amount: 1032000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
    ],
  },
  {
    id: "boq-005",
    boqNumber: "BOQ-2023-007",
    projectId: "proj-007",
    projectName: "Sharjah Model School",
    status: "completed",
    approvedBy: "Eng. Noura Al Qasimi",
    approvedDate: "2023-06-10",
    totalAmount: 18500000,
    completedAmount: 17900000,
    variationAmount: 420000,
    finalAmount: 18920000,
    completionPct: 100,
    items: [
      { id: "bi-005-01", itemCode: "A.1", description: "Piling & foundation", unit: "sum", quantity: 1, unitRate: 2800000, amount: 2800000, completedQty: 1, completedAmt: 2800000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-02", itemCode: "B.1", description: "Superstructure — frame, slabs, stairs", unit: "sum", quantity: 1, unitRate: 4500000, amount: 4500000, completedQty: 1, completedAmt: 4500000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-03", itemCode: "C.1", description: "Block masonry — 200mm, all floors", unit: "m²", quantity: 12000, unitRate: 185, amount: 2220000, completedQty: 12000, completedAmt: 2220000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-04", itemCode: "D.1", description: "Plastering & painting — internal", unit: "m²", quantity: 28000, unitRate: 95, amount: 2660000, completedQty: 28000, completedAmt: 2660000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-05", itemCode: "D.2", description: "Tiling — ceramic floor & wall tiles", unit: "m²", quantity: 14000, unitRate: 185, amount: 2590000, completedQty: 14000, completedAmt: 2590000, variationQty: 200, variationAmt: 37000 },
      { id: "bi-005-06", itemCode: "E.1", description: "MEP — electrical, plumbing, fire", unit: "sum", quantity: 1, unitRate: 2200000, amount: 2200000, completedQty: 1, completedAmt: 2200000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-07", itemCode: "E.2", description: "HVAC — split AC, 96 units", unit: "nr", quantity: 96, unitRate: 8500, amount: 816000, completedQty: 96, completedAmt: 816000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-08", itemCode: "F.1", description: "Doors & windows — aluminium frames", unit: "m²", quantity: 2800, unitRate: 850, amount: 2380000, completedQty: 2800, completedAmt: 2380000, variationQty: 220, variationAmt: 187000 },
      { id: "bi-005-09", itemCode: "G.1", description: "External works & parking", unit: "sum", quantity: 1, unitRate: 1200000, amount: 1200000, completedQty: 1, completedAmt: 1200000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-10", itemCode: "H.1", description: "Smart classroom equipment & fitout", unit: "sum", quantity: 1, unitRate: 850000, amount: 850000, completedQty: 1, completedAmt: 850000, variationQty: 0, variationAmt: 0 },
      { id: "bi-005-11", itemCode: "I.1", description: "Provisional sums & contingencies", unit: "sum", quantity: 1, unitRate: 484000, amount: 484000, completedQty: 1, completedAmt: 484000, variationQty: 0, variationAmt: 196000 },
    ],
  },
  {
    id: "boq-006",
    boqNumber: "BOQ-2025-008",
    projectId: "proj-008",
    projectName: "Dubai South Data Centre",
    status: "approved",
    approvedBy: "Eng. Saeed Al Suwaidi",
    approvedDate: "2025-05-10",
    totalAmount: 210000000,
    completedAmount: 38600000,
    variationAmount: 1800000,
    finalAmount: 211800000,
    completionPct: 18,
    items: [
      { id: "bi-006-01", itemCode: "A.1", description: "Site preparation & earthworks", unit: "sum", quantity: 1, unitRate: 3500000, amount: 3500000, completedQty: 1, completedAmt: 3500000, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-02", itemCode: "B.1", description: "Piling — 600mm bored piles, 240 nr", unit: "m", quantity: 4800, unitRate: 1100, amount: 5280000, completedQty: 4800, completedAmt: 5280000, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-03", itemCode: "B.2", description: "Reinforced concrete structure — main hall", unit: "m³", quantity: 22000, unitRate: 1200, amount: 26400000, completedQty: 16500, completedAmt: 19800000, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-04", itemCode: "B.3", description: "Raised access floor — data hall, 600x600mm", unit: "m²", quantity: 18000, unitRate: 620, amount: 11160000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-05", itemCode: "C.1", description: "HV switchgear & transformers — 20MW", unit: "sum", quantity: 1, unitRate: 28000000, amount: 28000000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-06", itemCode: "C.2", description: "UPS systems — 2N redundancy, 10MW", unit: "sum", quantity: 1, unitRate: 22000000, amount: 22000000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-07", itemCode: "C.3", description: "Diesel generators — 8 x 2.5MW", unit: "nr", quantity: 8, unitRate: 3200000, amount: 25600000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-08", itemCode: "D.1", description: "Precision cooling — CRAH units & piping", unit: "sum", quantity: 1, unitRate: 35000000, amount: 35000000, completedQty: 0, completedAmt: 0, variationQty: 1800000, variationAmt: 1800000 },
      { id: "bi-006-09", itemCode: "D.2", description: "Cooling towers — evaporative type", unit: "nr", quantity: 6, unitRate: 2800000, amount: 16800000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-10", itemCode: "E.1", description: "ELV & BMS systems", unit: "sum", quantity: 1, unitRate: 12000000, amount: 12000000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-11", itemCode: "E.2", description: "Fire suppression — FM-200 total flooding", unit: "sum", quantity: 1, unitRate: 6500000, amount: 6500000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-12", itemCode: "F.1", description: "Cable management — ladder racks, containment", unit: "sum", quantity: 1, unitRate: 4800000, amount: 4800000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-13", itemCode: "G.1", description: "Security — biometric access, CCTV, perimeter", unit: "sum", quantity: 1, unitRate: 5200000, amount: 5200000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-14", itemCode: "H.1", description: "External works & roads", unit: "sum", quantity: 1, unitRate: 3760000, amount: 3760000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
      { id: "bi-006-15", itemCode: "I.1", description: "Provisional sums", unit: "sum", quantity: 1, unitRate: 2000000, amount: 2000000, completedQty: 0, completedAmt: 0, variationQty: 0, variationAmt: 0 },
    ],
  },
];

export const boqSummary = {
  total: boqs.length,
  draft: boqs.filter((b) => b.status === "draft").length,
  approved: boqs.filter((b) => b.status === "approved" || b.status === "in_progress" || b.status === "completed").length,
  inProgress: boqs.filter((b) => b.status === "in_progress").length,
  completed: boqs.filter((b) => b.status === "completed").length,
  totalValue: boqs.reduce((s, b) => s + b.totalAmount, 0),
  completedValue: boqs.reduce((s, b) => s + b.completedAmount, 0),
  variationsValue: boqs.reduce((s, b) => s + b.variationAmount, 0),
  avgCompletion: Math.round(
    boqs.reduce((s, b) => s + b.completionPct, 0) / boqs.length
  ),
};
