"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, Plus, Minus, UtensilsCrossed, ChevronRight, Users, Clock,
  Search, Star, AlertTriangle, Receipt, Trash2,
} from "lucide-react";
import {
  restaurantTables, menuItems, restaurantOrders, restaurantSummary,
  type RestaurantTable, type TableStatus, type RestaurantSection,
  type DishCategory, type RestaurantOrder, type MenuItem,
} from "@/mock/data/pos.mock";
import { formatCurrency } from "@/lib/utils";
import { AddTableForm } from "./add-table-form";

const TABLE_STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  available:      { label: "Available",      color: "text-success",          bg: "bg-success/10",     border: "border-success/30",     dot: "bg-success" },
  occupied:       { label: "Occupied",       color: "text-primary",          bg: "bg-primary/10",     border: "border-primary/30",     dot: "bg-primary" },
  reserved:       { label: "Reserved",       color: "text-blue-500",         bg: "bg-blue-500/10",    border: "border-blue-500/30",    dot: "bg-blue-500" },
  bill_requested: { label: "Bill Requested", color: "text-warning",          bg: "bg-warning/10",     border: "border-warning/30",     dot: "bg-warning" },
  cleaning:       { label: "Cleaning",       color: "text-muted-foreground", bg: "bg-muted/20",       border: "border-border",         dot: "bg-muted-foreground" },
};

const SECTION_CONFIG: Record<RestaurantSection, { label: string; emoji: string }> = {
  indoor:  { label: "Indoor",         emoji: "🏠" },
  outdoor: { label: "Outdoor",        emoji: "☀️" },
  terrace: { label: "Terrace",        emoji: "🌅" },
  private: { label: "Private Dining", emoji: "🍽️" },
};

const DISH_CATEGORIES: { value: DishCategory | "all"; label: string; emoji: string }[] = [
  { value: "all",       label: "All",         emoji: "🍽️" },
  { value: "starters",  label: "Starters",    emoji: "🫘" },
  { value: "mains",     label: "Mains",       emoji: "🍽️" },
  { value: "grills",    label: "Grills",      emoji: "🔥" },
  { value: "pasta",     label: "Pasta",       emoji: "🍝" },
  { value: "pizza",     label: "Pizza",       emoji: "🍕" },
  { value: "desserts",  label: "Desserts",    emoji: "🍮" },
  { value: "beverages", label: "Beverages",   emoji: "🍋" },
  { value: "shisha",    label: "Shisha",      emoji: "💨" },
];

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:             { label: "Open",             color: "text-muted-foreground", bg: "bg-muted/30" },
  sent_to_kitchen:  { label: "In Kitchen",       color: "text-warning",          bg: "bg-warning/10" },
  partially_served: { label: "Partially Served", color: "text-blue-500",         bg: "bg-blue-500/10" },
  served:           { label: "Served",           color: "text-success",          bg: "bg-success/10" },
  closed:           { label: "Closed",           color: "text-foreground",       bg: "bg-muted/20" },
  cancelled:        { label: "Cancelled",        color: "text-destructive",      bg: "bg-destructive/10" },
};

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: "Pending",   color: "text-muted-foreground" },
  preparing:{ label: "Preparing", color: "text-warning" },
  ready:    { label: "Ready",     color: "text-success" },
  served:   { label: "Served",    color: "text-primary" },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent = "bg-primary" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={`w-1.5 h-1.5 rounded-full ${accent} mb-2`} />
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ table, onClick }: { table: RestaurantTable; onClick: () => void }) {
  const cfg = TABLE_STATUS_CONFIG[table.status];
  const order = restaurantOrders.find(o => o.id === table.currentOrderId);

  return (
    <button
      onClick={onClick}
      className={`bg-card border rounded-xl p-4 text-left transition-all hover:shadow-md group relative ${cfg.border}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-2xl font-bold text-foreground">{table.tableNumber}</p>
          <p className="text-xs text-muted-foreground">{SECTION_CONFIG[table.section].emoji} {SECTION_CONFIG[table.section].label}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {table.capacity} cap</span>
        {table.guestCount && <span className="text-foreground font-medium">{table.guestCount} guests</span>}
        {table.openedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {table.openedAt}</span>}
      </div>

      {table.waiter && (
        <p className="text-xs text-muted-foreground truncate">{table.waiter}</p>
      )}

      {order && (
        <p className="text-xs font-medium text-primary mt-1">{order.orderNumber} · {formatCurrency(order.total, "AED")}</p>
      )}

      <ChevronRight className="absolute right-3 bottom-3 w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Order Drawer ─────────────────────────────────────────────────────────────
function OrderDrawer({
  table, order, onClose,
}: {
  table: RestaurantTable;
  order: RestaurantOrder | null;
  onClose: () => void;
}) {
  const [menuSearch, setMenuSearch] = React.useState("");
  const [menuCategory, setMenuCategory] = React.useState<string>("all");
  const [activePanel, setActivePanel] = React.useState<"order" | "menu">(order ? "order" : "menu");

  const filteredMenu = React.useMemo(() => {
    return menuItems.filter(m => {
      const q = menuSearch.toLowerCase();
      const matchSearch = !q || m.name.toLowerCase().includes(q);
      const matchCat = menuCategory === "all" || m.category === menuCategory;
      return matchSearch && matchCat && m.isAvailable;
    });
  }, [menuSearch, menuCategory]);

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xl font-bold text-foreground">Table {table.tableNumber}</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TABLE_STATUS_CONFIG[table.status].bg} ${TABLE_STATUS_CONFIG[table.status].color}`}>
                {TABLE_STATUS_CONFIG[table.status].label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {SECTION_CONFIG[table.section].label} · {table.capacity} capacity
              {table.guestCount ? ` · ${table.guestCount} guests` : ""}
              {table.waiter ? ` · ${table.waiter}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-border">
          {[
            { key: "order", label: "Current Order" },
            { key: "menu",  label: "Add Items" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActivePanel(tab.key as "order" | "menu")}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                activePanel === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {activePanel === "order" ? (
            <div className="p-5">
              {!order ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <UtensilsCrossed className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No active order</p>
                  <Button size="sm" className="mt-4" onClick={() => setActivePanel("menu")}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Start Order
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Order header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">Opened: {order.openedAt} · {order.waiter}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_CONFIG[order.status]?.bg} ${ORDER_STATUS_CONFIG[order.status]?.color}`}>
                      {ORDER_STATUS_CONFIG[order.status]?.label}
                    </span>
                  </div>

                  {/* Note */}
                  {order.notes && (
                    <div className="bg-warning/5 border border-warning/20 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground">{order.notes}</p>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="space-y-2.5">
                    {order.items.map((item, i) => {
                      const ic = ITEM_STATUS_CONFIG[item.status];
                      return (
                        <div key={i} className="flex items-start justify-between py-2.5 border-b border-border last:border-0">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-foreground">{item.name}</p>
                              <span className={`text-xs font-medium ${ic.color}`}>{ic.label}</span>
                            </div>
                            {item.notes && (
                              <p className="text-xs text-warning mt-0.5 italic">"{item.notes}"</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatCurrency(item.price, "AED")} × {item.quantity}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground flex-shrink-0">
                            {formatCurrency(item.total, "AED")}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal</span><span>{formatCurrency(order.subtotal, "AED")}</span>
                    </div>
                    {order.discountAmount > 0 && (
                      <div className="flex justify-between text-xs text-success">
                        <span>Discount</span><span>-{formatCurrency(order.discountAmount, "AED")}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Tax</span><span>{formatCurrency(order.taxAmount, "AED")}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border">
                      <span>Total</span><span>{formatCurrency(order.total, "AED")}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Menu Panel */
            <div className="p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  placeholder="Search menu…"
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* Category pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {DISH_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setMenuCategory(cat.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      menuCategory === cat.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* Menu Items */}
              <div className="space-y-2">
                {filteredMenu.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl hover:bg-muted/30 transition-colors">
                    <span className="text-2xl">{item.image}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        {item.isPopular && <Star className="w-3 h-3 text-warning fill-warning" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.nameAr} · {item.prepTime}min</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(item.price, "AED")}</p>
                      <button className="mt-1 flex items-center gap-0.5 text-xs text-primary hover:underline">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2">
          {order && (
            <>
              <Button className="flex-1" size="sm">
                <Receipt className="w-3.5 h-3.5 mr-1.5" /> Bill
              </Button>
              <Button variant="outline" size="sm">Send to Kitchen</Button>
            </>
          )}
          {!order && (
            <Button className="flex-1" size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Open Order
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function RestaurantPOSView() {
  const [sectionFilter, setSectionFilter] = React.useState<string>("all");
  const [selectedTable, setSelectedTable] = React.useState<RestaurantTable | null>(null);
  const [activeTab, setActiveTab] = React.useState<"floor" | "orders">("floor");
  const [showAddTableForm, setShowAddTableForm] = React.useState(false);

  const sections: RestaurantSection[] = ["indoor", "outdoor", "terrace", "private"];

  const filteredTables = React.useMemo(() => {
    return restaurantTables.filter(t =>
      sectionFilter === "all" || t.section === sectionFilter
    );
  }, [sectionFilter]);

  const selectedOrder = React.useMemo(() => {
    if (!selectedTable?.currentOrderId) return null;
    return restaurantOrders.find(o => o.id === selectedTable.currentOrderId) ?? null;
  }, [selectedTable]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-bold text-foreground">Restaurant POS</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {restaurantSummary.totalTables} tables · {restaurantSummary.occupied} occupied · {restaurantSummary.activeOrders} active orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === "floor" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("floor")}>
            Floor Plan
          </Button>
          <Button variant={activeTab === "orders" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("orders")}>
            Orders
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddTableForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Table
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Tables" value={restaurantSummary.totalTables} accent="bg-primary" />
          <StatCard label="Occupied" value={restaurantSummary.occupied} accent="bg-primary" />
          <StatCard label="Available" value={restaurantSummary.available} accent="bg-success" />
          <StatCard label="Reserved" value={restaurantSummary.reserved} accent="bg-blue-500" />
          <StatCard label="Bill Req." value={restaurantSummary.billRequested} accent="bg-warning" />
          <StatCard label="Active Orders" value={restaurantSummary.activeOrders} accent="bg-warning" />
        </div>

        {activeTab === "floor" ? (
          <>
            {/* Section Filter */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSectionFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sectionFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                All Sections
              </button>
              {sections.map(s => (
                <button
                  key={s}
                  onClick={() => setSectionFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    sectionFilter === s ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {SECTION_CONFIG[s].emoji} {SECTION_CONFIG[s].label}
                </button>
              ))}
            </div>

            {/* Floor Plan Grid — grouped by section */}
            {(sectionFilter === "all" ? sections : [sectionFilter as RestaurantSection]).map(section => {
              const sectionTables = filteredTables.filter(t => t.section === section);
              if (sectionTables.length === 0) return null;
              return (
                <div key={section}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {SECTION_CONFIG[section].emoji} {SECTION_CONFIG[section].label}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                    <p className="text-xs text-muted-foreground">{sectionTables.length} tables</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {sectionTables.map(table => (
                      <TableCard key={table.id} table={table} onClick={() => setSelectedTable(table)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          /* Orders Tab */
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Active Orders</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Order #", "Table", "Items", "Subtotal", "Total", "Status", "Waiter", "Opened", ""].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {restaurantOrders.map(order => {
                    const sc = ORDER_STATUS_CONFIG[order.status];
                    const table = restaurantTables.find(t => t.id === order.tableId);
                    return (
                      <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-3 text-xs font-mono text-foreground">{order.orderNumber}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{order.tableNumber}</td>
                        <td className="px-4 py-3 text-xs text-foreground">{order.items.length} items</td>
                        <td className="px-4 py-3 text-xs text-foreground">{formatCurrency(order.subtotal, "AED")}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{formatCurrency(order.total, "AED")}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc?.bg} ${sc?.color}`}>
                            {sc?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground">{order.waiter}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{order.openedAt}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              const t = restaurantTables.find(tb => tb.id === order.tableId);
                              if (t) setSelectedTable(t);
                              setActiveTab("floor");
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            View <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedTable && (
          <OrderDrawer
            table={selectedTable}
            order={selectedOrder}
            onClose={() => setSelectedTable(null)}
          />
        )}
      </AnimatePresence>
      <AddTableForm open={showAddTableForm} onClose={() => setShowAddTableForm(false)} />
    </div>
  );
}
