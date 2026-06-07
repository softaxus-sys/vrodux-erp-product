import { stockItems } from "./inventory-stock.mock";

// ─── POS Shared Types ─────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "card" | "apple_pay" | "samsung_pay" | "voucher" | "split";
export type TransactionStatus = "completed" | "refunded" | "voided" | "new";

// ─── Retail POS ───────────────────────────────────────────────────────────────

export type ProductCategory =
  | "beverages" | "snacks" | "electronics" | "accessories"
  | "stationery" | "personal_care" | "gifts" | "tobacco";

export interface POSProduct {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  price: number;
  taxRate: number;
  stock: number;
  barcode: string;
  image: string; // emoji placeholder
}

export interface POSLineItem {
  productId: string;
  name: string;
  price: number;
  taxRate: number;
  quantity: number;
  total: number;
}

export interface POSTransaction {
  id: string;
  receiptNumber: string;
  items: POSLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashier: string;
  timestamp: string;
  status: TransactionStatus;
  customerId: string | null;
}

// Derived from inventory — all stock items marked as isPosItem are sold via Retail POS.
// This keeps stock levels as the single source of truth.
export const posProducts: POSProduct[] = stockItems
  .filter(i => i.isPosItem)
  .map(i => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    category: i.posCategory as ProductCategory,
    price: i.sellingPrice ?? 0,
    taxRate: i.taxRate ?? 5,
    stock: i.availableQty,
    barcode: i.barcode ?? "",
    image: i.image ?? "📦",
  }));

export const posTransactions: POSTransaction[] = [
  {
    id: "tx-001", receiptNumber: "RCP-2026-0901",
    items: [
      { productId: "p-001", name: "Voss Water 500ml", price: 18, taxRate: 5, quantity: 2, total: 36 },
      { productId: "p-006", name: "Pringles Original 165g", price: 24, taxRate: 5, quantity: 1, total: 24 },
    ],
    subtotal: 60, discountAmount: 0, taxAmount: 3, total: 63,
    paymentMethod: "card", cashier: "Ahmed Salah", timestamp: "2026-05-20T08:12:00", status: "completed", customerId: null,
  },
  {
    id: "tx-002", receiptNumber: "RCP-2026-0902",
    items: [
      { productId: "p-012", name: "Power Bank 10000mAh", price: 220, taxRate: 5, quantity: 1, total: 220 },
      { productId: "p-010", name: "USB-C Cable 1m (Anker)", price: 65, taxRate: 5, quantity: 1, total: 65 },
    ],
    subtotal: 285, discountAmount: 15, taxAmount: 13.5, total: 283.5,
    paymentMethod: "apple_pay", cashier: "Lina Tanaka", timestamp: "2026-05-20T09:04:00", status: "completed", customerId: "cust-112",
  },
  {
    id: "tx-003", receiptNumber: "RCP-2026-0903",
    items: [
      { productId: "p-019", name: "Oud Perfume 50ml", price: 280, taxRate: 5, quantity: 1, total: 280 },
      { productId: "p-020", name: "Date Box (Premium)", price: 95, taxRate: 5, quantity: 2, total: 190 },
      { productId: "p-007", name: "Ferrero Rocher 16pc", price: 65, taxRate: 5, quantity: 1, total: 65 },
    ],
    subtotal: 535, discountAmount: 0, taxAmount: 26.75, total: 561.75,
    paymentMethod: "card", cashier: "Ahmed Salah", timestamp: "2026-05-20T10:22:00", status: "completed", customerId: null,
  },
  {
    id: "tx-004", receiptNumber: "RCP-2026-0904",
    items: [
      { productId: "p-004", name: "Nespresso Lungo", price: 22, taxRate: 5, quantity: 1, total: 22 },
      { productId: "p-009", name: "Haribo Gold Bears 250g", price: 18, taxRate: 5, quantity: 1, total: 18 },
    ],
    subtotal: 40, discountAmount: 0, taxAmount: 2, total: 42,
    paymentMethod: "cash", cashier: "Lina Tanaka", timestamp: "2026-05-20T11:05:00", status: "completed", customerId: null,
  },
  {
    id: "tx-005", receiptNumber: "RCP-2026-0905",
    items: [
      { productId: "p-011", name: "Wireless Earbuds (Anker)", price: 180, taxRate: 5, quantity: 1, total: 180 },
    ],
    subtotal: 180, discountAmount: 0, taxAmount: 9, total: 189,
    paymentMethod: "card", cashier: "Ahmed Salah", timestamp: "2026-05-20T12:48:00", status: "refunded", customerId: null,
  },
];

export const posSummary = {
  todaySales: posTransactions.filter(t => t.status === "completed").reduce((s, t) => s + t.total, 0),
  todayTransactions: posTransactions.filter(t => t.status === "completed").length,
  avgBasketValue: Math.round(
    posTransactions.filter(t => t.status === "completed").reduce((s, t) => s + t.total, 0) /
    posTransactions.filter(t => t.status === "completed").length
  ),
  refunds: posTransactions.filter(t => t.status === "refunded").length,
};

// ─── Restaurant POS ───────────────────────────────────────────────────────────

export type TableStatus = "available" | "occupied" | "reserved" | "bill_requested" | "cleaning";
export type OrderStatus = "open" | "sent_to_kitchen" | "partially_served" | "served" | "closed" | "cancelled";
export type RestaurantSection = "indoor" | "outdoor" | "terrace" | "private";

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  section: RestaurantSection;
  capacity: number;
  status: TableStatus;
  currentOrderId: string | null;
  guestCount: number | null;
  openedAt: string | null;
  waiter: string | null;
}

export type DishCategory = "starters" | "mains" | "grills" | "pasta" | "pizza" | "salads" | "desserts" | "beverages" | "shisha";

export interface MenuItem {
  id: string;
  name: string;
  nameAr: string;
  category: DishCategory;
  price: number;
  taxRate: number;
  prepTime: number; // minutes
  isAvailable: boolean;
  image: string;
  isPopular: boolean;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  notes: string;
  status: "new" | "preparing" | "ready" | "served";
}

export interface RestaurantOrder {
  id: string;
  orderNumber: string;
  tableId: string;
  tableNumber: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  status: OrderStatus;
  waiter: string;
  openedAt: string;
  notes: string;
}

export const restaurantTables: RestaurantTable[] = [
  // Indoor
  { id: "tbl-01", tableNumber: "T01", section: "indoor", capacity: 2, status: "occupied", currentOrderId: "ord-001", guestCount: 2, openedAt: "12:15", waiter: "Khalid Hassan" },
  { id: "tbl-02", tableNumber: "T02", section: "indoor", capacity: 4, status: "occupied", currentOrderId: "ord-002", guestCount: 3, openedAt: "12:32", waiter: "Priya Sharma" },
  { id: "tbl-03", tableNumber: "T03", section: "indoor", capacity: 4, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-04", tableNumber: "T04", section: "indoor", capacity: 6, status: "reserved", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-05", tableNumber: "T05", section: "indoor", capacity: 2, status: "cleaning", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-06", tableNumber: "T06", section: "indoor", capacity: 4, status: "bill_requested", currentOrderId: "ord-003", guestCount: 4, openedAt: "11:45", waiter: "Khalid Hassan" },
  { id: "tbl-07", tableNumber: "T07", section: "indoor", capacity: 2, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-08", tableNumber: "T08", section: "indoor", capacity: 8, status: "occupied", currentOrderId: "ord-004", guestCount: 7, openedAt: "13:00", waiter: "Priya Sharma" },
  // Outdoor
  { id: "tbl-09", tableNumber: "O01", section: "outdoor", capacity: 4, status: "occupied", currentOrderId: "ord-005", guestCount: 2, openedAt: "12:50", waiter: "Omar Al Farsi" },
  { id: "tbl-10", tableNumber: "O02", section: "outdoor", capacity: 4, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-11", tableNumber: "O03", section: "outdoor", capacity: 6, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-12", tableNumber: "O04", section: "outdoor", capacity: 4, status: "reserved", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  // Terrace
  { id: "tbl-13", tableNumber: "TR1", section: "terrace", capacity: 2, status: "occupied", currentOrderId: "ord-006", guestCount: 2, openedAt: "13:10", waiter: "Omar Al Farsi" },
  { id: "tbl-14", tableNumber: "TR2", section: "terrace", capacity: 4, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-15", tableNumber: "TR3", section: "terrace", capacity: 6, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  // Private Dining
  { id: "tbl-16", tableNumber: "PD1", section: "private", capacity: 10, status: "reserved", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
  { id: "tbl-17", tableNumber: "PD2", section: "private", capacity: 14, status: "available", currentOrderId: null, guestCount: null, openedAt: null, waiter: null },
];

export const menuItems: MenuItem[] = [
  // Starters
  { id: "m-001", name: "Hummus with Pita", nameAr: "حمص مع خبز بيتا", category: "starters", price: 38, taxRate: 5, prepTime: 5, isAvailable: true, image: "🫘", isPopular: true },
  { id: "m-002", name: "Fattoush Salad", nameAr: "سلطة فتوش", category: "starters", price: 45, taxRate: 5, prepTime: 8, isAvailable: true, image: "🥗", isPopular: false },
  { id: "m-003", name: "Grilled Halloumi", nameAr: "حلومي مشوي", category: "starters", price: 55, taxRate: 5, prepTime: 10, isAvailable: true, image: "🧀", isPopular: true },
  { id: "m-004", name: "Chicken Wings (6pc)", nameAr: "أجنحة دجاج", category: "starters", price: 65, taxRate: 5, prepTime: 15, isAvailable: true, image: "🍗", isPopular: true },
  // Mains
  { id: "m-005", name: "Grilled Hammour Fillet", nameAr: "فيليه هامور مشوي", category: "mains", price: 145, taxRate: 5, prepTime: 20, isAvailable: true, image: "🐟", isPopular: true },
  { id: "m-006", name: "Chicken Mandi", nameAr: "مندي دجاج", category: "mains", price: 120, taxRate: 5, prepTime: 25, isAvailable: true, image: "🍚", isPopular: false },
  { id: "m-007", name: "Lamb Ouzi", nameAr: "أوزي لحم", category: "mains", price: 195, taxRate: 5, prepTime: 30, isAvailable: true, image: "🍖", isPopular: true },
  { id: "m-008", name: "Vegetable Biryani", nameAr: "برياني خضار", category: "mains", price: 85, taxRate: 5, prepTime: 20, isAvailable: true, image: "🍛", isPopular: false },
  // Grills
  { id: "m-009", name: "Wagyu Beef Tenderloin 250g", nameAr: "تندرلوين واغيو ٢٥٠ جم", category: "grills", price: 320, taxRate: 5, prepTime: 25, isAvailable: true, image: "🥩", isPopular: true },
  { id: "m-010", name: "Mixed Grill Platter", nameAr: "طبق مشاوي مشكل", category: "grills", price: 220, taxRate: 5, prepTime: 30, isAvailable: true, image: "🍢", isPopular: true },
  { id: "m-011", name: "Grilled Jumbo Prawns", nameAr: "روبيان جمبو مشوي", category: "grills", price: 185, taxRate: 5, prepTime: 20, isAvailable: true, image: "🦐", isPopular: false },
  // Pasta & Pizza
  { id: "m-012", name: "Truffle Fettuccine", nameAr: "فيتوتشيني بالكمأ", category: "pasta", price: 110, taxRate: 5, prepTime: 18, isAvailable: true, image: "🍝", isPopular: true },
  { id: "m-013", name: "Margherita Pizza (12\")", nameAr: "بيتزا مرغريتا", category: "pizza", price: 75, taxRate: 5, prepTime: 15, isAvailable: true, image: "🍕", isPopular: false },
  { id: "m-014", name: "Prawn & Rocket Pizza (12\")", nameAr: "بيتزا الروبيان والجرجير", category: "pizza", price: 115, taxRate: 5, prepTime: 18, isAvailable: false, image: "🍕", isPopular: false },
  // Desserts
  { id: "m-015", name: "Umm Ali", nameAr: "أم علي", category: "desserts", price: 45, taxRate: 5, prepTime: 8, isAvailable: true, image: "🍮", isPopular: true },
  { id: "m-016", name: "Chocolate Lava Cake", nameAr: "كيكة اللافا بالشوكولاتة", category: "desserts", price: 55, taxRate: 5, prepTime: 12, isAvailable: true, image: "🍫", isPopular: true },
  // Beverages
  { id: "m-017", name: "Fresh Lemon Mint", nameAr: "ليمون نعناع طازج", category: "beverages", price: 28, taxRate: 5, prepTime: 3, isAvailable: true, image: "🍋", isPopular: true },
  { id: "m-018", name: "Arabic Coffee Pot", nameAr: "دلة قهوة عربية", category: "beverages", price: 35, taxRate: 5, prepTime: 5, isAvailable: true, image: "☕", isPopular: false },
  { id: "m-019", name: "Fresh Juice (Orange/Mango)", nameAr: "عصير طازج (برتقال/مانجو)", category: "beverages", price: 32, taxRate: 5, prepTime: 5, isAvailable: true, image: "🍊", isPopular: false },
  // Shisha
  { id: "m-020", name: "Double Apple Shisha", nameAr: "شيشة تفاحتين", category: "shisha", price: 120, taxRate: 100, prepTime: 10, isAvailable: true, image: "💨", isPopular: true },
  { id: "m-021", name: "Mint Shisha", nameAr: "شيشة نعناع", category: "shisha", price: 120, taxRate: 100, prepTime: 10, isAvailable: true, image: "💨", isPopular: false },
];

export const restaurantOrders: RestaurantOrder[] = [
  {
    id: "ord-001", orderNumber: "ORD-0541", tableId: "tbl-01", tableNumber: "T01",
    items: [
      { menuItemId: "m-001", name: "Hummus with Pita", price: 38, quantity: 1, total: 38, notes: "", status: "served" },
      { menuItemId: "m-009", name: "Wagyu Beef Tenderloin 250g", price: 320, quantity: 2, total: 640, notes: "One medium, one medium-rare", status: "preparing" },
      { menuItemId: "m-017", name: "Fresh Lemon Mint", price: 28, quantity: 2, total: 56, notes: "", status: "served" },
    ],
    subtotal: 734, discountAmount: 0, taxAmount: 33.05, total: 767.05,
    status: "sent_to_kitchen", waiter: "Khalid Hassan", openedAt: "12:15", notes: "Anniversary couple — special setup",
  },
  {
    id: "ord-002", orderNumber: "ORD-0542", tableId: "tbl-02", tableNumber: "T02",
    items: [
      { menuItemId: "m-003", name: "Grilled Halloumi", price: 55, quantity: 1, total: 55, notes: "", status: "served" },
      { menuItemId: "m-010", name: "Mixed Grill Platter", price: 220, quantity: 1, total: 220, notes: "Extra bread", status: "preparing" },
      { menuItemId: "m-005", name: "Grilled Hammour Fillet", price: 145, quantity: 1, total: 145, notes: "", status: "preparing" },
      { menuItemId: "m-019", name: "Fresh Juice", price: 32, quantity: 3, total: 96, notes: "2x mango, 1x orange", status: "served" },
    ],
    subtotal: 516, discountAmount: 0, taxAmount: 23.22, total: 539.22,
    status: "partially_served", waiter: "Priya Sharma", openedAt: "12:32", notes: "",
  },
  {
    id: "ord-003", orderNumber: "ORD-0539", tableId: "tbl-06", tableNumber: "T06",
    items: [
      { menuItemId: "m-004", name: "Chicken Wings (6pc)", price: 65, quantity: 2, total: 130, notes: "", status: "served" },
      { menuItemId: "m-007", name: "Lamb Ouzi", price: 195, quantity: 2, total: 390, notes: "", status: "served" },
      { menuItemId: "m-015", name: "Umm Ali", price: 45, quantity: 4, total: 180, notes: "", status: "served" },
      { menuItemId: "m-017", name: "Fresh Lemon Mint", price: 28, quantity: 4, total: 112, notes: "", status: "served" },
      { menuItemId: "m-020", name: "Double Apple Shisha", price: 120, quantity: 1, total: 120, notes: "", status: "served" },
    ],
    subtotal: 932, discountAmount: 50, taxAmount: 96.38, total: 978.38,
    status: "served", waiter: "Khalid Hassan", openedAt: "11:45", notes: "Bill requested",
  },
  {
    id: "ord-004", orderNumber: "ORD-0543", tableId: "tbl-08", tableNumber: "T08",
    items: [
      { menuItemId: "m-001", name: "Hummus with Pita", price: 38, quantity: 2, total: 76, notes: "", status: "served" },
      { menuItemId: "m-002", name: "Fattoush Salad", price: 45, quantity: 2, total: 90, notes: "", status: "served" },
      { menuItemId: "m-009", name: "Wagyu Beef Tenderloin", price: 320, quantity: 3, total: 960, notes: "", status: "preparing" },
      { menuItemId: "m-012", name: "Truffle Fettuccine", price: 110, quantity: 2, total: 220, notes: "No truffle for one guest — allergy", status: "new" },
      { menuItemId: "m-016", name: "Chocolate Lava Cake", price: 55, quantity: 7, total: 385, notes: "", status: "new" },
    ],
    subtotal: 1731, discountAmount: 0, taxAmount: 78, total: 1809,
    status: "sent_to_kitchen", waiter: "Priya Sharma", openedAt: "13:00", notes: "Corporate dinner — ADNOC",
  },
  {
    id: "ord-005", orderNumber: "ORD-0544", tableId: "tbl-09", tableNumber: "O01",
    items: [
      { menuItemId: "m-013", name: "Margherita Pizza", price: 75, quantity: 1, total: 75, notes: "", status: "preparing" },
      { menuItemId: "m-017", name: "Fresh Lemon Mint", price: 28, quantity: 2, total: 56, notes: "", status: "served" },
    ],
    subtotal: 131, discountAmount: 0, taxAmount: 5.9, total: 136.9,
    status: "sent_to_kitchen", waiter: "Omar Al Farsi", openedAt: "12:50", notes: "",
  },
  {
    id: "ord-006", orderNumber: "ORD-0545", tableId: "tbl-13", tableNumber: "TR1",
    items: [
      { menuItemId: "m-003", name: "Grilled Halloumi", price: 55, quantity: 1, total: 55, notes: "", status: "new" },
      { menuItemId: "m-021", name: "Mint Shisha", price: 120, quantity: 1, total: 120, notes: "", status: "new" },
      { menuItemId: "m-018", name: "Arabic Coffee Pot", price: 35, quantity: 1, total: 35, notes: "", status: "new" },
    ],
    subtotal: 210, discountAmount: 0, taxAmount: 16.25, total: 226.25,
    status: "sent_to_kitchen", waiter: "Omar Al Farsi", openedAt: "13:10", notes: "",
  },
];

export const restaurantSummary = {
  totalTables: restaurantTables.length,
  occupied: restaurantTables.filter(t => t.status === "occupied").length,
  available: restaurantTables.filter(t => t.status === "available").length,
  reserved: restaurantTables.filter(t => t.status === "reserved").length,
  billRequested: restaurantTables.filter(t => t.status === "bill_requested").length,
  activeOrders: restaurantOrders.filter(o => o.status !== "closed" && o.status !== "cancelled").length,
  todayRevenue: restaurantOrders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0),
};

// ─── Kitchen Display System ───────────────────────────────────────────────────

export type KDSStatus = "received" | "preparing" | "ready" | "served";
export type KDSPriority = "rush" | "normal";

export interface KDSOrderItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
  status: KDSStatus;
  prepTime: number;
}

export interface KDSOrder {
  id: string;
  orderNumber: string;
  tableNumber: string;
  section: RestaurantSection;
  items: KDSOrderItem[];
  status: KDSStatus;
  priority: KDSPriority;
  waiter: string;
  receivedAt: string; // ISO
  startedAt: string | null;
  readyAt: string | null;
  notes: string;
}

export const kdsOrders: KDSOrder[] = [
  {
    id: "kds-001", orderNumber: "ORD-0541", tableNumber: "T01", section: "indoor",
    priority: "rush", waiter: "Khalid Hassan",
    receivedAt: "2026-05-20T12:18:00", startedAt: "2026-05-20T12:20:00", readyAt: null,
    status: "preparing", notes: "Anniversary couple",
    items: [
      { id: "ki-001", name: "Wagyu Beef Tenderloin 250g", quantity: 1, notes: "Medium", status: "preparing", prepTime: 25 },
      { id: "ki-002", name: "Wagyu Beef Tenderloin 250g", quantity: 1, notes: "Medium-Rare", status: "preparing", prepTime: 25 },
    ],
  },
  {
    id: "kds-002", orderNumber: "ORD-0542", tableNumber: "T02", section: "indoor",
    priority: "normal", waiter: "Priya Sharma",
    receivedAt: "2026-05-20T12:35:00", startedAt: "2026-05-20T12:38:00", readyAt: null,
    status: "preparing", notes: "",
    items: [
      { id: "ki-003", name: "Mixed Grill Platter", quantity: 1, notes: "Extra bread", status: "preparing", prepTime: 30 },
      { id: "ki-004", name: "Grilled Hammour Fillet", quantity: 1, notes: "", status: "preparing", prepTime: 20 },
    ],
  },
  {
    id: "kds-003", orderNumber: "ORD-0543", tableNumber: "T08", section: "indoor",
    priority: "rush", waiter: "Priya Sharma",
    receivedAt: "2026-05-20T13:02:00", startedAt: "2026-05-20T13:05:00", readyAt: null,
    status: "preparing", notes: "⚠️ Allergy: No truffle for 1 fettuccine",
    items: [
      { id: "ki-005", name: "Wagyu Beef Tenderloin 250g", quantity: 3, notes: "All medium", status: "preparing", prepTime: 25 },
      { id: "ki-006", name: "Truffle Fettuccine", quantity: 1, notes: "", status: "preparing", prepTime: 18 },
      { id: "ki-007", name: "Truffle Fettuccine (NO TRUFFLE)", quantity: 1, notes: "⚠️ ALLERGY — no truffle", status: "received", prepTime: 18 },
    ],
  },
  {
    id: "kds-004", orderNumber: "ORD-0544", tableNumber: "O01", section: "outdoor",
    priority: "normal", waiter: "Omar Al Farsi",
    receivedAt: "2026-05-20T12:52:00", startedAt: "2026-05-20T12:55:00", readyAt: null,
    status: "preparing", notes: "",
    items: [
      { id: "ki-008", name: "Margherita Pizza (12\")", quantity: 1, notes: "", status: "preparing", prepTime: 15 },
    ],
  },
  {
    id: "kds-005", orderNumber: "ORD-0545", tableNumber: "TR1", section: "terrace",
    priority: "normal", waiter: "Omar Al Farsi",
    receivedAt: "2026-05-20T13:12:00", startedAt: null, readyAt: null,
    status: "received", notes: "",
    items: [
      { id: "ki-009", name: "Grilled Halloumi", quantity: 1, notes: "", status: "received", prepTime: 10 },
    ],
  },
  {
    id: "kds-006", orderNumber: "ORD-0538", tableNumber: "T04", section: "indoor",
    priority: "normal", waiter: "Khalid Hassan",
    receivedAt: "2026-05-20T11:20:00", startedAt: "2026-05-20T11:22:00", readyAt: "2026-05-20T11:50:00",
    status: "ready", notes: "",
    items: [
      { id: "ki-010", name: "Umm Ali", quantity: 4, notes: "", status: "ready", prepTime: 8 },
      { id: "ki-011", name: "Chocolate Lava Cake", quantity: 2, notes: "", status: "ready", prepTime: 12 },
    ],
  },
];

export const kdsSummary = {
  received: kdsOrders.filter(o => o.status === "received").length,
  preparing: kdsOrders.filter(o => o.status === "preparing").length,
  ready: kdsOrders.filter(o => o.status === "ready").length,
  rush: kdsOrders.filter(o => o.priority === "rush").length,
};

