"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search, Building2, Home, TrendingUp, DollarSign,
  Percent, Plus, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { useProperties, useRealEstateSummary } from "@/hooks/real-estate/use-real-estate";
import type { PropertyDto, PropertyType, PropertyStatus } from "@/lib/real-estate/real-estate.api";
import { PropertiesDrawer } from "./properties-drawer";
import { AddPropertyForm } from "./add-property-form";

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

const STATUS_CONFIG: Record<PropertyStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success bg-success/10" },
  inactive: { label: "Inactive", className: "text-muted-foreground bg-muted" },
  under_development: { label: "In Development", className: "text-warning bg-warning/10" },
};

// STAT_CARDS computed dynamically inside component

export function PropertiesView() {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<PropertyDto | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: properties = [], isLoading } = useProperties();
  const { data: summary } = useRealEstateSummary();

  const totalPortfolioValue = React.useMemo(() =>
    properties.reduce((s, p) => s + p.totalValue, 0), [properties]);
  const activeCount = properties.filter(p => p.status === "active").length;

  const STAT_CARDS = [
    { label: "Total Properties", value: (summary?.totalProperties ?? properties.length).toString(), icon: Building2, color: "text-primary bg-primary/10" },
    { label: "Active",           value: activeCount.toString(),                                     icon: Home,      color: "text-success bg-success/10" },
    { label: "Total Units",      value: (summary?.totalUnits ?? 0).toLocaleString(),                icon: BarChart3, color: "text-blue-600 bg-blue-500/10" },
    { label: "Avg Occupancy",    value: `${summary?.occupancyRate ?? 0}%`,                          icon: Percent,   color: "text-warning bg-warning/10" },
    { label: "Portfolio Value",  value: formatCurrency(totalPortfolioValue, "AED"),                 icon: DollarSign,color: "text-purple-600 bg-purple-500/10" },
    { label: "Annual Rent",      value: formatCurrency(summary?.totalAnnualRent ?? 0, "AED"),       icon: TrendingUp,color: "text-success bg-success/10" },
  ];

  const filtered = React.useMemo(() => {
    return properties.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(q) ||
        p.propertyCode.toLowerCase().includes(q) ||
        p.locationCity.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || p.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [properties, search, typeFilter]);

  const handleView = (p: PropertyDto) => {
    setSelected(p);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

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
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", s.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-base font-bold leading-tight truncate">{s.value}</p>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                    No properties found.
                  </td>
                </tr>
              ) : (
                filtered.map((prop, i) => (
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
                        {prop.propertyCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{prop.name}</p>
                        <p className="text-[11px] text-muted-foreground">{prop.developer}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          TYPE_BADGE[prop.type]
                        )}
                      >
                        {TYPE_LABELS[prop.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{prop.locationCity}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{prop.totalUnits}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          prop.vacantUnits > 10
                            ? "text-warning"
                            : prop.vacantUnits > 0
                              ? "text-muted-foreground"
                              : "text-success"
                        )}
                      >
                        {prop.vacantUnits}
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
                      {formatCurrency(prop.totalValue, "AED")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                          STATUS_CONFIG[prop.status].className
                        )}
                      >
                        {STATUS_CONFIG[prop.status].label}
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
            Showing {filtered.length} of {properties.length} properties
          </span>
        </div>
      </div>

      <PropertiesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} property={selected} />
      <AddPropertyForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
