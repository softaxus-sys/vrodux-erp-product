import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Building2, Home, TrendingUp, DollarSign,
  Percent, Plus, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, fitTextClass } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { PropertyDto as Property, PropertyType, PropertyStatus } from "@/lib/real-estate/re.api";
import { useProperties, usePropertySummary } from "@/hooks/real-estate/use-re";
import { PropertiesDrawer } from "./properties-drawer";
import { AddPropertyForm } from "./add-property-form";
import { Pager } from "@/components/ui/pager";

const PAGE_SIZE = 30;

const TYPE_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Mixed Use", value: "mixed_use" },
  { label: "Industrial", value: "industrial" },
  { label: "Retail", value: "retail" },
];

const TYPE_BADGE: Record<PropertyType, string> = {
  residential: "bg-primary/10 text-primary",
  commercial: "bg-blue-500/10 text-blue-600",
  mixed_use: "bg-purple-500/10 text-purple-600",
  industrial: "bg-orange-500/10 text-orange-600",
  retail: "bg-pink-500/10 text-pink-600",
};

const TYPE_LABELS: Record<PropertyType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed_use: "Mixed Use",
  industrial: "Industrial",
  retail: "Retail",
};

// The values the API actually returns. Previously "active" / "inactive" / "under_development",
// none of which the server ever sends — so every row fell through to the fallback and read
// "Unknown". (The fallback here is why the LIST survived while the drawer, which indexed the same
// map bare, crashed the page.)
const STATUS_CONFIG: Record<PropertyStatus, { label: string; className: string }> = {
  available:          { label: "Available",  className: "text-warning bg-warning/10" },
  partially_occupied: { label: "Partial",    className: "text-primary bg-primary/10" },
  fully_occupied:     { label: "Full",       className: "text-success bg-success/10" },
};

const STATUS_FALLBACK = { label: "Unknown", className: "text-muted-foreground bg-muted" };
const getStatus = (s: string) => STATUS_CONFIG[s as PropertyStatus] ?? STATUS_FALLBACK;
const getTypeBadge = (t: string) => TYPE_BADGE[t as PropertyType] ?? "bg-muted text-muted-foreground";
const getTypeLabel = (t: string) => TYPE_LABELS[t as PropertyType] ?? t;

/** Vacancy is derived — the API reports occupied, not vacant. */
const vacantOf = (p: Property) => Math.max(0, p.totalUnits - p.occupiedUnits);

export function PropertiesView() {
  const currency = useCurrency();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Property | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [editing, setEditing] = React.useState<Property | null>(null);

  const [page, setPage] = React.useState(1);

  // Typing now hits the server, so the request waits until they stop.
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Both filters now narrow in SQL. Filtering in the browser cannot survive paging: it would
  // filter within one page and under-report.
  React.useEffect(() => { setPage(1); }, [debouncedSearch, typeFilter]);

  const { data: paged, isFetching } = useProperties({
    search: debouncedSearch || undefined,
    propertyType: typeFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const properties = paged?.items ?? [];
  const totalCount = paged?.totalCount ?? 0;
  const totalPages = paged?.totalPages ?? 1;

  const { data: propertySummary } = usePropertySummary();

  const STAT_CARDS = [
    {
      label: "Total Properties",
      value: (propertySummary?.total ?? properties.length).toString(),
      icon: Building2,
      color: "text-primary bg-primary/10",
    },
    {
      // Was "Active", counting p.status === "active" — a value the API never returns, so it
      // always read 0. Occupied units is the figure the summary endpoint actually provides.
      label: "Occupied Units",
      value: (propertySummary?.occupiedUnits ?? properties.reduce((s, p) => s + p.occupiedUnits, 0)).toLocaleString(),
      icon: Home,
      color: "text-success bg-success/10",
    },
    {
      label: "Total Units",
      value: (propertySummary?.totalUnits ?? properties.reduce((s, p) => s + p.totalUnits, 0)).toLocaleString(),
      icon: BarChart3,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Avg Occupancy",
      value: `${propertySummary?.occupancyRate ?? (properties.length > 0 ? Math.round(properties.reduce((s, p) => s + p.occupancyRate, 0) / properties.length) : 0)}%`,
      icon: Percent,
      color: "text-warning bg-warning/10",
    },
    {
      label: "Portfolio Value",
      value: formatCurrency(propertySummary?.totalMarketValue ?? properties.reduce((s, p) => s + p.marketValue, 0), currency),
      icon: DollarSign,
      color: "text-purple-600 bg-purple-500/10",
    },
    {
      // The property carries no rent of its own; it lives on the units the API returns with it.
      // The old p.annualRent did not exist and summed to NaN.
      label: "Annual Rent (let)",
      value: formatCurrency(
        properties.reduce((s, p) =>
          s + (p.units ?? []).filter(u => u.status === "rented").reduce((n, u) => n + (u.rentPerYear ?? 0), 0), 0),
        currency),
      icon: TrendingUp,
      color: "text-success bg-success/10",
    },
  ];

  const handleView = (p: Property) => {
    setSelected(p);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Manage real estate properties, listings, and portfolio details.
          </p>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" /> Add Property
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
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 min-w-0"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
                <p className={cn("font-bold leading-tight truncate", fitTextClass(s.value, "lg"))} title={String(s.value)}>{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, code, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                typeFilter === f.value
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
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  City
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Units
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Vacant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-[140px]">
                  Occupancy
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {totalCount === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                    No properties found.
                  </td>
                </tr>
              ) : (
                properties.map((prop, i) => (
                  <motion.tr
                    key={prop.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => handleView(prop)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                        {prop.propertyNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{prop.name}</p>
                        <p className="text-[11px] text-muted-foreground">{prop.developer ?? "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          getTypeBadge(prop.propertyType)
                        )}
                      >
                        {getTypeLabel(prop.propertyType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{prop.location?.city ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{prop.totalUnits}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          vacantOf(prop) > 10
                            ? "text-warning"
                            : vacantOf(prop) > 0
                              ? "text-muted-foreground"
                              : "text-success"
                        )}
                      >
                        {vacantOf(prop)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              prop.occupancyRate >= 90
                                ? "bg-success"
                                : prop.occupancyRate >= 75
                                  ? "bg-warning"
                                  : "bg-destructive"
                            )}
                            style={{ width: `${prop.occupancyRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-12 text-right">
                          {prop.occupancyRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap">
                      {formatCurrency(prop.marketValue, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                          getStatus(prop.status).className
                        )}
                      >
                        {getStatus(prop.status).label}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalCount > 0 && (
          <div className="border-t border-border">
            <Pager page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} busy={isFetching} onPage={setPage} />
          </div>
        )}
      </div>

      <PropertiesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        property={selected}
        onEdit={(p) => { setEditing(p); setDrawerOpen(false); setShowAddForm(true); }}
      />
      <AddPropertyForm
        open={showAddForm}
        editing={editing}
        // Cleared on close, or the next "Add Property" would open the form still in edit mode and
        // overwrite the property that was edited last.
        onClose={() => { setShowAddForm(false); setEditing(null); }}
      />
    </div>
  );
}

