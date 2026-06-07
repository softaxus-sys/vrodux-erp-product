export type TransferStatus = "draft" | "pending" | "in_transit" | "received" | "cancelled";

export interface TransferItem {
  id: string;
  stockItemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: TransferStatus;
  requestedBy: string;
  approvedBy: string | null;
  requestDate: string;
  expectedDate: string;
  receivedDate: string | null;
  items: TransferItem[];
  totalValue: number;
  notes: string;
}

export const stockTransfers: StockTransfer[] = [
  {
    id: "tr-001",
    transferNumber: "TRF-2026-0001",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-002",
    toWarehouseName: "Abu Dhabi Branch Warehouse",
    status: "received",
    requestedBy: "Fatima Al Mansoori",
    approvedBy: "Khalid Al Rashidi",
    requestDate: "2026-04-01",
    expectedDate: "2026-04-05",
    receivedDate: "2026-04-05",
    items: [
      { id: "tri-001a", stockItemId: "stk-006", itemName: "Dell 27\" 4K Monitor P2723D", sku: "HW-MON-001", quantity: 5, unitCost: 3200, total: 16000 },
      { id: "tri-001b", stockItemId: "stk-013", itemName: "HP EliteBook 840 G10 Laptop", sku: "HW-LAP-001", quantity: 3, unitCost: 8400, total: 25200 },
    ],
    totalValue: 41200,
    notes: "Q2 stock replenishment for Abu Dhabi office project.",
  },
  {
    id: "tr-002",
    transferNumber: "TRF-2026-0002",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-003",
    toWarehouseName: "Sharjah Transit Hub",
    status: "received",
    requestedBy: "Mohammed Al Hammadi",
    approvedBy: "Khalid Al Rashidi",
    requestDate: "2026-04-08",
    expectedDate: "2026-04-10",
    receivedDate: "2026-04-10",
    items: [
      { id: "tri-002a", stockItemId: "stk-004", itemName: "Single Mode Fiber Patch Cable 10m", sku: "NET-FIB-001", quantity: 50, unitCost: 85, total: 4250 },
      { id: "tri-002b", stockItemId: "stk-020", itemName: "Cat6A Ethernet Cable 305m Reel", sku: "NET-CAB-001", quantity: 3, unitCost: 1850, total: 5550 },
    ],
    totalValue: 9800,
    notes: "Cables for Sharjah site deployment.",
  },
  {
    id: "tr-003",
    transferNumber: "TRF-2026-0003",
    fromWarehouseId: "wh-002",
    fromWarehouseName: "Abu Dhabi Branch Warehouse",
    toWarehouseId: "wh-001",
    toWarehouseName: "Dubai Main Warehouse",
    status: "in_transit",
    requestedBy: "Ahmed Al Zaabi",
    approvedBy: "Fatima Al Mansoori",
    requestDate: "2026-05-12",
    expectedDate: "2026-05-15",
    receivedDate: null,
    items: [
      { id: "tri-003a", stockItemId: "stk-010", itemName: "HP 507A Toner Set (CMYK)", sku: "CONS-INK-001", quantity: 8, unitCost: 420, total: 3360 },
    ],
    totalValue: 3360,
    notes: "Excess consumables return to main warehouse.",
  },
  {
    id: "tr-004",
    transferNumber: "TRF-2026-0004",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-005",
    toWarehouseName: "Dubai Bonded Warehouse",
    status: "in_transit",
    requestedBy: "Tariq Siddiqui",
    approvedBy: "Khalid Al Rashidi",
    requestDate: "2026-05-14",
    expectedDate: "2026-05-18",
    receivedDate: null,
    items: [
      { id: "tri-004a", stockItemId: "stk-015", itemName: "VMware vSphere 8 Enterprise Plus", sku: "SW-VMWARE-001", quantity: 4, unitCost: 22000, total: 88000 },
      { id: "tri-004b", stockItemId: "stk-005", itemName: "Microsoft 365 Business Premium License", sku: "SW-MS365-001", quantity: 10, unitCost: 2200, total: 22000 },
    ],
    totalValue: 110000,
    notes: "Software licenses for export customer shipment.",
  },
  {
    id: "tr-005",
    transferNumber: "TRF-2026-0005",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-002",
    toWarehouseName: "Abu Dhabi Branch Warehouse",
    status: "in_transit",
    requestedBy: "Fatima Al Mansoori",
    approvedBy: "Khalid Al Rashidi",
    requestDate: "2026-05-16",
    expectedDate: "2026-05-20",
    receivedDate: null,
    items: [
      { id: "tri-005a", stockItemId: "stk-003", itemName: "APC Smart-UPS 3000VA", sku: "HW-UPS-001", quantity: 3, unitCost: 5200, total: 15600 },
      { id: "tri-005b", stockItemId: "stk-002", itemName: "Cisco Catalyst 9300 Switch 48P", sku: "NET-SW-001", quantity: 2, unitCost: 18500, total: 37000 },
    ],
    totalValue: 52600,
    notes: "Network equipment for ADNOC project deployment.",
  },
  {
    id: "tr-006",
    transferNumber: "TRF-2026-0006",
    fromWarehouseId: "wh-003",
    fromWarehouseName: "Sharjah Transit Hub",
    toWarehouseId: "wh-002",
    toWarehouseName: "Abu Dhabi Branch Warehouse",
    status: "pending",
    requestedBy: "Fatima Al Mansoori",
    approvedBy: null,
    requestDate: "2026-05-18",
    expectedDate: "2026-05-22",
    receivedDate: null,
    items: [
      { id: "tri-006a", stockItemId: "stk-014", itemName: "Cisco Meraki MR46 Access Point", sku: "NET-WAP-001", quantity: 2, unitCost: 3800, total: 7600 },
    ],
    totalValue: 7600,
    notes: "Awaiting management approval.",
  },
  {
    id: "tr-007",
    transferNumber: "TRF-2026-0007",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-002",
    toWarehouseName: "Abu Dhabi Branch Warehouse",
    status: "draft",
    requestedBy: "Sara Ahmed",
    approvedBy: null,
    requestDate: "2026-05-19",
    expectedDate: "2026-05-25",
    receivedDate: null,
    items: [
      { id: "tri-007a", stockItemId: "stk-012", itemName: "Dell PowerEdge Hot-Swap Fan Module", sku: "SP-FAN-001", quantity: 10, unitCost: 380, total: 3800 },
      { id: "tri-007b", stockItemId: "stk-019", itemName: "APC Smart-UPS Replacement Battery", sku: "SP-BATT-001", quantity: 15, unitCost: 240, total: 3600 },
    ],
    totalValue: 7400,
    notes: "Spare parts for Abu Dhabi data centre maintenance.",
  },
  {
    id: "tr-008",
    transferNumber: "TRF-2026-0008",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-003",
    toWarehouseName: "Sharjah Transit Hub",
    status: "draft",
    requestedBy: "Mohammed Al Hammadi",
    approvedBy: null,
    requestDate: "2026-05-19",
    expectedDate: "2026-05-24",
    receivedDate: null,
    items: [
      { id: "tri-008a", stockItemId: "stk-009", itemName: "42U Network Rack Cabinet", sku: "HW-RACK-001", quantity: 2, unitCost: 4800, total: 9600 },
    ],
    totalValue: 9600,
    notes: "Racks for Sharjah Transit Hub upgrade.",
  },
  {
    id: "tr-009",
    transferNumber: "TRF-2026-0009",
    fromWarehouseId: "wh-002",
    fromWarehouseName: "Abu Dhabi Branch Warehouse",
    toWarehouseId: "wh-005",
    toWarehouseName: "Dubai Bonded Warehouse",
    status: "received",
    requestedBy: "Tariq Siddiqui",
    approvedBy: "Fatima Al Mansoori",
    requestDate: "2026-03-20",
    expectedDate: "2026-03-25",
    receivedDate: "2026-03-25",
    items: [
      { id: "tri-009a", stockItemId: "stk-022", itemName: "Autodesk AutoCAD LT 2026 License", sku: "SW-AUTOCAD-001", quantity: 5, unitCost: 4500, total: 22500 },
    ],
    totalValue: 22500,
    notes: "Licenses transferred to bonded zone for re-export.",
  },
  {
    id: "tr-010",
    transferNumber: "TRF-2026-0010",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-002",
    toWarehouseName: "Abu Dhabi Branch Warehouse",
    status: "received",
    requestedBy: "Fatima Al Mansoori",
    approvedBy: "Khalid Al Rashidi",
    requestDate: "2026-02-15",
    expectedDate: "2026-02-18",
    receivedDate: "2026-02-18",
    items: [
      { id: "tri-010a", stockItemId: "stk-001", itemName: "Dell PowerEdge R750 Server", sku: "HW-SRV-001", quantity: 2, unitCost: 42000, total: 84000 },
    ],
    totalValue: 84000,
    notes: "Servers for Abu Dhabi branch data centre buildout.",
  },
  {
    id: "tr-011",
    transferNumber: "TRF-2026-0011",
    fromWarehouseId: "wh-005",
    fromWarehouseName: "Dubai Bonded Warehouse",
    toWarehouseId: "wh-001",
    toWarehouseName: "Dubai Main Warehouse",
    status: "cancelled",
    requestedBy: "Tariq Siddiqui",
    approvedBy: null,
    requestDate: "2026-04-22",
    expectedDate: "2026-04-26",
    receivedDate: null,
    items: [
      { id: "tri-011a", stockItemId: "stk-011", itemName: "Cisco ASR 1001-X Router", sku: "NET-RTR-001", quantity: 1, unitCost: 85000, total: 85000 },
    ],
    totalValue: 85000,
    notes: "Cancelled — customer order was revoked.",
  },
  {
    id: "tr-012",
    transferNumber: "TRF-2026-0012",
    fromWarehouseId: "wh-001",
    fromWarehouseName: "Dubai Main Warehouse",
    toWarehouseId: "wh-004",
    toWarehouseName: "Dubai Cold Store Facility",
    status: "received",
    requestedBy: "Priya Nair",
    approvedBy: "Khalid Al Rashidi",
    requestDate: "2026-01-10",
    expectedDate: "2026-01-12",
    receivedDate: "2026-01-12",
    items: [
      { id: "tri-012a", stockItemId: "stk-019", itemName: "APC Smart-UPS Replacement Battery", sku: "SP-BATT-001", quantity: 20, unitCost: 240, total: 4800 },
    ],
    totalValue: 4800,
    notes: "Backup batteries for cold store facility UPS systems.",
  },
];

export const transfersSummary = {
  total: stockTransfers.length,
  draft: stockTransfers.filter((t) => t.status === "draft").length,
  pending: stockTransfers.filter((t) => t.status === "pending").length,
  inTransit: stockTransfers.filter((t) => t.status === "in_transit").length,
  received: stockTransfers.filter((t) => t.status === "received").length,
  cancelled: stockTransfers.filter((t) => t.status === "cancelled").length,
  totalValue: stockTransfers
    .filter((t) => t.status !== "cancelled")
    .reduce((s, t) => s + t.totalValue, 0),
};
