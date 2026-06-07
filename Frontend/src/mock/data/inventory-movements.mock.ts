import { stockItems } from "./inventory-stock.mock";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MovementType = "in" | "out" | "transfer" | "adjustment" | "write_off" | "count_correction";

export interface MovementRecord {
  id: string;
  date: string;            // ISO date
  time: string;            // HH:MM
  type: MovementType;
  itemId: string;
  sku: string;
  itemName: string;
  category: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;        // always positive; sign inferred from type
  unitCost: number;
  valueImpact: number;     // positive = increase, negative = decrease
  reference: string;       // PO, SO, TRF, ADJ ref
  reason?: string;         // for adjustments
  by: string;              // username
  notes?: string;
}

// ─── Build movement log from stock items ─────────────────────────────────────

let _id = 1;
const pad = (n: number) => String(n).padStart(4, "0");

export const movementRecords: MovementRecord[] = (stockItems.flatMap(item =>
  item.movements.map(mv => {
    const type: MovementType =
      mv.type === "in"         ? "in"         :
      mv.type === "out"        ? "out"        :
      mv.type === "transfer"   ? "transfer"   :
      mv.type === "adjustment" ? "adjustment" : "adjustment";

    const sign = type === "in" ? 1 : -1;

    return {
      id:            `mvt-${pad(_id++)}`,
      date:          mv.date,
      time:          `${8 + (_id % 10)}:${String((_id * 7) % 60).padStart(2, "0")}`,
      type,
      itemId:        item.id,
      sku:           item.sku,
      itemName:      item.name,
      category:      item.category,
      warehouseId:   item.warehouseId,
      warehouseName: item.warehouseName,
      quantity:      mv.quantity,
      unitCost:      item.unitCost,
      valueImpact:   sign * mv.quantity * item.unitCost,
      reference:     mv.reference,
      by:            mv.by,
    } satisfies MovementRecord;
  })
) as MovementRecord[]).concat([
  // ── Extra manual adjustments for demo richness ──────────────────────────
  {
    id: "mvt-adj-001",
    date: "2026-05-15", time: "09:30",
    type: "count_correction",
    itemId: "stk-001", sku: "HW-SRV-001", itemName: "Dell PowerEdge R750 Server",
    category: "hardware", warehouseId: "wh-001", warehouseName: "Dubai Main Warehouse",
    quantity: 1, unitCost: 42000, valueImpact: 42000,
    reference: "CNT-2026-0021", by: "Ravi Kumar",
    reason: "Physical count correction — 1 unit found in transit zone",
    notes: "Item was misplaced during May cycle count",
  },
  {
    id: "mvt-adj-002",
    date: "2026-05-14", time: "14:15",
    type: "write_off",
    itemId: "stk-010", sku: "CONS-INK-001", itemName: "HP 507A Toner Set (CMYK)",
    category: "consumables", warehouseId: "wh-002", warehouseName: "Abu Dhabi Branch Warehouse",
    quantity: 2, unitCost: 420, valueImpact: -840,
    reference: "WO-2026-0008", by: "Fatima Al Mansoori",
    reason: "Write-off — damaged in transit, packaging compromised",
  },
  {
    id: "mvt-adj-003",
    date: "2026-05-13", time: "11:00",
    type: "adjustment",
    itemId: "p-002", sku: "BEV-002", itemName: "Coca-Cola 330ml",
    category: "beverages", warehouseId: "wh-pos", warehouseName: "Dubai POS Store",
    quantity: 12, unitCost: 4, valueImpact: 48,
    reference: "ADJ-2026-0044", by: "Store Manager",
    reason: "Stock recount — 12 cans found in back storage",
  },
  {
    id: "mvt-adj-004",
    date: "2026-05-12", time: "16:45",
    type: "write_off",
    itemId: "p-005", sku: "BEV-005", itemName: "Fresh Orange Juice",
    category: "beverages", warehouseId: "wh-pos", warehouseName: "Dubai POS Store",
    quantity: 5, unitCost: 15, valueImpact: -75,
    reference: "WO-2026-0007", by: "Ahmed Salah",
    reason: "Expired — passed best-before date",
    notes: "Implement FIFO rotation for fresh beverages",
  },
  {
    id: "mvt-adj-005",
    date: "2026-05-11", time: "08:20",
    type: "in",
    itemId: "p-011", sku: "ELC-002", itemName: "Wireless Earbuds (Anker)",
    category: "electronics", warehouseId: "wh-pos", warehouseName: "Dubai POS Store",
    quantity: 6, unitCost: 95, valueImpact: 570,
    reference: "PO-2026-0320", by: "Store Manager",
  },
  {
    id: "mvt-adj-006",
    date: "2026-05-10", time: "13:00",
    type: "transfer",
    itemId: "stk-006", sku: "HW-MON-001", itemName: "Dell 27\" 4K Monitor P2723D",
    category: "hardware", warehouseId: "wh-001", warehouseName: "Dubai Main Warehouse",
    quantity: 3, unitCost: 3200, valueImpact: -9600,
    reference: "TRF-2026-0033", by: "Ahmed Al Zaabi",
    reason: "Transfer to Abu Dhabi Branch Warehouse",
  },
]);

// Sort by date desc, then time desc
movementRecords.sort((a, b) =>
  a.date === b.date
    ? b.time.localeCompare(a.time)
    : b.date.localeCompare(a.date)
);

// ─── Summary ──────────────────────────────────────────────────────────────────

const today = "2026-05-20";

export const movementsSummary = {
  totalRecords:      movementRecords.length,
  todayIn:           movementRecords.filter(m => m.date === today && m.type === "in").length,
  todayOut:          movementRecords.filter(m => m.date === today && m.type === "out").length,
  adjustments:       movementRecords.filter(m => m.type === "adjustment" || m.type === "count_correction").length,
  writeOffs:         movementRecords.filter(m => m.type === "write_off").length,
  totalValueIn:      movementRecords.filter(m => m.valueImpact > 0).reduce((s, m) => s + m.valueImpact, 0),
  totalValueOut:     Math.abs(movementRecords.filter(m => m.valueImpact < 0).reduce((s, m) => s + m.valueImpact, 0)),
};
