"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Plus, Building2, CheckCircle, BarChart3, Package, DollarSign, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useWarehouses, useWarehouseSummary } from "@/hooks/inventory/use-warehouses";
import type { WarehouseDto } from "@/lib/inventory/warehouses.api";
import { WarehousesDrawer } from "./warehouses-drawer";
import { AddWarehouseForm } from "./add-warehouse-form";

const typeLabels: Record<string, string> = {
  main: "Main",
  transit: "Transit",
  cold_storage: "Cold Storage",
  bonded: "Bonded",
};

const typeColors: Record<string, string> = {
  main: "bg-primary/10 text-primary",
  transit: "bg-warning/10 text-warning",
  cold_storage: "bg-blue-500/10 text-blue-500",
  bonded: "bg-purple-500/10 text-purple-500",
};

export function WarehousesView() {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<WarehouseDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const { data: warehouses = [], isLoading } = useWarehouses();
  const { data: summary } = useWarehouseSummary();

  const types = ["all", "main", "transit", "cold_storage", "bonded"];

  const filtered = React.useMemo(() => {
    return warehouses.filter((w) => {
      const matchSearch =
        search === "" ||
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.code.toLowerCase().includes(search.toLowerCase()) ||
        w.locationCity.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || w.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [warehouses, search, typeFilter]);

  const statCards = [
    {
      label: "Total Warehouses",
      value: summary?.total ?? warehouses.length,
      icon: Building2,
      color: "text-primary",
      bg: "bg-primary/10",
      fmt: (v: number) => String(v),
    },
    {
      label: "Active",
      value: summary?.active ?? warehouses.filter((w) => w.status === "active").length,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
      fmt: (v: number) => String(v),
    },
    {
      label: "Total Capacity",
      value: summary?.totalCapacity ?? 0,
      icon: BarChart3,
      color: "text-warning",
      bg: "bg-warning/10",
      fmt: (v: number) => `${v.toLocaleString()} sqm`,
    },
    {
      label: "Avg Utilization",
      value: summary?.avgUtilization ?? 0,
      icon: Package,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      fmt: (v: number) => `${v}%`,
    },
    {
      label: "Total SKUs",
      value: summary?.totalSKUs ?? 0,
      icon: DollarSign,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      fmt: (v: number) => v.toLocaleString(),
    },
  ];

  function openDrawer(w: WarehouseDto) {
    setSelected(w);
    setDrawerOpen(true);
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Warehouses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage warehouse locations, zones, and capacity utilization.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />
          Add Warehouse
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-3", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-xl font-bold">{card.fmt(card.value)}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search warehouses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                typeFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t === "all" ? "All Types" : typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((w, idx) => {
          const utilizationColor =
            w.utilizationPct >= 90
              ? "bg-destructive"
              : w.utilizationPct >= 70
                ? "bg-warning"
                : "bg-success";
          const utilizationTextColor =
            w.utilizationPct >= 90
              ? "text-destructive"
              : w.utilizationPct >= 70
                ? "text-warning"
                : "text-success";

          return (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => openDrawer(w)}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{w.code}</span>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        typeColors[w.type]
                      )}
                    >
                      {typeLabels[w.type]}
                    </span>
                  </div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">{w.name}</h3>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                    w.status === "active"
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {w.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Utilization Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">Utilization</span>
                  <span className={cn("text-xs font-bold", utilizationTextColor)}>
                    {w.utilizationPct}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", utilizationColor)}
                    style={{ width: `${w.utilizationPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                  <span>{w.utilized.toLocaleString()} sqm</span>
                  <span>{w.capacity.toLocaleString()} sqm</span>
                </div>
              </div>

              {/* Location & Manager */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{w.locationCity} — {w.locationAddress}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span>{w.manager}</span>
                </div>
              </div>

              {/* Footer Stats */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">SKUs</p>
                  <p className="text-sm font-bold">{w.totalSKUs.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Zones</p>
                  <p className="text-sm font-bold">{w.zones.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="text-sm font-bold">{formatCurrency(w.totalValue, "AED")}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-sm">No warehouses match your filters.</p>
        </div>
      )}

      <WarehousesDrawer
        warehouse={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <AddWarehouseForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
