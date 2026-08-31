import * as React from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  Search, Home, AlertTriangle, CheckCircle2,
  Wrench, TrendingUp, DollarSign, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { UnitDto as Unit, UnitStatus } from "@/lib/real-estate/re.api";
import { useUnits, useUnitSummary, useProperties } from "@/hooks/real-estate/use-re";
import { UnitsDrawer } from "./units-drawer";
import { AddUnitForm } from "./add-unit-form";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Vacant", value: "vacant" },
  { label: "Rented", value: "rented" },
  { label: "Reserved", value: "reserved" },
  { label: "Maintenance", value: "maintenance" },
  { label: "For Sale", value: "for_sale" },
  { label: "Sold", value: "sold" },
];

const STATUS_CONFIG: Record<UnitStatus, { label: string; className: string }> = {
  rented: { label: "Rented", className: "text-success bg-success/10" },
  vacant: { label: "Vacant", className: "text-warning bg-warning/10" },
  reserved: { label: "Reserved", className: "text-primary bg-primary/10" },
  maintenance: { label: "Maintenance", className: "text-destructive bg-destructive/10" },
  for_sale: { label: "For Sale", className: "text-blue-600 bg-blue-500/10" },
  sold: { label: "Sold", className: "text-muted-foreground bg-muted" },
};

const STATUS_FALLBACK = { label: "Unknown", className: "text-muted-foreground bg-muted" };

/** Never index the map bare: an unrecognised status must degrade to a grey chip, not take the
 *  page down. The properties drawer did exactly that and crashed on every property. */
const getUnitStatus = (s: string) => STATUS_CONFIG[s as UnitStatus] ?? STATUS_FALLBACK;

const TYPE_LABELS: Record<string, string> = {
  apartment: "Apartment",
  villa: "Villa",
  office: "Office",
  retail_shop: "Retail Shop",
  warehouse: "Warehouse",
  studio: "Studio",
};

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
}

export function UnitsView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  // Seeded from ?propertyId= so the property drawer's "View All Units" lands on this page already
  // filtered, rather than dropping the user into the full list of every unit in the portfolio.
  const [searchParams, setSearchParams] = useSearchParams();
  const [propertyFilter, setPropertyFilter] = React.useState(searchParams.get("propertyId") ?? "all");

  // Strip the param once consumed, or "back to catalogue" style navigation re-applies it and the
  // filter cannot be cleared.
  React.useEffect(() => {
    if (!searchParams.get("propertyId")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("propertyId");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Unit | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: units = [] } = useUnits();
  const { data: unitSummary } = useUnitSummary();
  const { data: properties = [] } = useProperties();

  const STAT_CARDS = [
    {
      label: "Total Units",
      value: (unitSummary?.total ?? units.length).toString(),
      icon: Home,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Vacant",
      value: (unitSummary?.vacant ?? units.filter(u => u.status === "vacant").length).toString(),
      icon: AlertTriangle,
      color: "text-warning bg-warning/10",
    },
    {
      label: "Rented",
      value: (unitSummary?.rented ?? units.filter(u => u.status === "rented").length).toString(),
      icon: CheckCircle2,
      color: "text-success bg-success/10",
    },
    {
      label: "Maintenance",
      value: (unitSummary?.maintenance ?? units.filter(u => u.status === "maintenance").length).toString(),
      icon: Wrench,
      color: "text-destructive bg-destructive/10",
    },
    {
      label: "For Sale",
      value: (unitSummary?.forSale ?? units.filter(u => u.status === "for_sale").length).toString(),
      icon: DollarSign,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Occupancy Rate",
      value: `${unitSummary?.occupancyRate ?? (units.length > 0 ? Math.round(units.filter(u => u.status === "rented").length / units.length * 100) : 0)}%`,
      icon: TrendingUp,
      color: "text-success bg-success/10",
    },
  ];

  const filtered = React.useMemo(() => {
    return units.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        u.unitNumber.toLowerCase().includes(q) ||
        u.propertyName.toLowerCase().includes(q) ||
        (u.tenantName ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      const matchProp = propertyFilter === "all" || u.propertyId === propertyFilter;
      return matchSearch && matchStatus && matchProp;
    });
  }, [search, statusFilter, propertyFilter, units]);

  const handleView = (u: Unit) => {
    setSelected(u);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Units</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            View and manage all units across the real estate portfolio.
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Unit
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-base font-bold leading-tight">{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search unit, property, tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Unit #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Floor
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Area (sqm)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Beds
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Rent PA
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Expiry
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground text-sm">
                    No units found.
                  </td>
                </tr>
              ) : (
                filtered.map((unit, i) => (
                  <motion.tr
                    key={unit.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => handleView(unit)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded font-semibold">
                        {unit.unitNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {unit.propertyName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[unit.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{unit.floor}</td>
                    <td className="px-4 py-3 text-right text-sm">{unit.area}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {unit.bedrooms === null
                        ? "—"
                        : unit.bedrooms === 0
                          ? "Studio"
                          : unit.bedrooms}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">
                      {formatCurrency(unit.rentPricePA, currency)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {unit.tenantName ? (
                        <span className="font-medium">{unit.tenantName}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {unit.contractExpiry ? (
                        <span
                          className={cn(
                            "flex items-center gap-1 font-medium",
                            isExpiringSoon(unit.contractExpiry)
                              ? "text-warning"
                              : "text-muted-foreground"
                          )}
                        >
                          {isExpiringSoon(unit.contractExpiry) && (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          )}
                          {formatDate(unit.contractExpiry, "medium")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                          getUnitStatus(unit.status).className
                        )}
                      >
                        {getUnitStatus(unit.status).label}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Showing {filtered.length} of {units.length} units
          </span>
        </div>
      </div>

      <UnitsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} unit={selected} />
      <AddUnitForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}

