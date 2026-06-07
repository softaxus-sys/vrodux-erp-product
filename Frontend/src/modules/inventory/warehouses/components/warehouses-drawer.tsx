"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, User, Phone, Mail, Calendar, Package, DollarSign, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { WarehouseDto } from "@/lib/inventory/warehouses.api";

interface WarehousesDrawerProps {
  warehouse: WarehouseDto | null;
  open: boolean;
  onClose: () => void;
}

const typeLabels: Record<string, string> = {
  main: "Main Warehouse",
  transit: "Transit Hub",
  cold_storage: "Cold Storage",
  bonded: "Bonded Warehouse",
};

const typeColors: Record<string, string> = {
  main: "bg-primary/10 text-primary",
  transit: "bg-warning/10 text-warning",
  cold_storage: "bg-blue-500/10 text-blue-500",
  bonded: "bg-purple-500/10 text-purple-500",
};

export function WarehousesDrawer({ warehouse, open, onClose }: WarehousesDrawerProps) {
  // WarehouseDto uses flat locationCity / locationAddress
  if (!warehouse) return null;

  const utilizationColor =
    warehouse.utilizationPct >= 90
      ? "bg-destructive"
      : warehouse.utilizationPct >= 70
        ? "bg-warning"
        : "bg-success";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full max-w-[580px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Grid3x3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{warehouse.name}</h2>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        warehouse.status === "active"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {warehouse.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{warehouse.code}</span>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        typeColors[warehouse.type]
                      )}
                    >
                      {typeLabels[warehouse.type]}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Capacity Bar */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Capacity Utilization</span>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      warehouse.utilizationPct >= 90
                        ? "text-destructive"
                        : warehouse.utilizationPct >= 70
                          ? "text-warning"
                          : "text-success"
                    )}
                  >
                    {warehouse.utilizationPct}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", utilizationColor)}
                    style={{ width: `${warehouse.utilizationPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{warehouse.utilized.toLocaleString()} sqm used</span>
                  <span>{warehouse.capacity.toLocaleString()} sqm total</span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Package className="h-4 w-4" />
                    <span className="text-xs">Total SKUs</span>
                  </div>
                  <p className="text-xl font-bold">{warehouse.totalSKUs.toLocaleString()}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs">Stock Value</span>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(warehouse.totalValue, "AED")}</p>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Location</h3>
                <div className="flex items-start gap-3 bg-muted/30 rounded-xl p-4 border border-border">
                  <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{warehouse.locationCity}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{warehouse.locationAddress}</p>
                  </div>
                </div>
              </div>

              {/* Manager */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Warehouse Manager</h3>
                <div className="flex items-center gap-4 bg-muted/30 rounded-xl p-4 border border-border">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {getInitials(warehouse.manager)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{warehouse.manager}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {warehouse.managerPhone}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      {warehouse.managerEmail}
                    </span>
                  </div>
                </div>
              </div>

              {/* Zones */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Storage Zones ({warehouse.zones.length})
                </h3>
                <div className="space-y-2">
                  {warehouse.zones.map((zone, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-2.5 border border-border"
                    >
                      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{idx + 1}</span>
                      </div>
                      <span className="text-sm">{zone}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Schedule */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Audit Schedule</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Last Audit</span>
                    </div>
                    <p className="text-sm font-semibold">{formatDate(warehouse.lastAudit, "medium")}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Next Audit</span>
                    </div>
                    <p className="text-sm font-semibold">{formatDate(warehouse.nextAudit, "medium")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border shrink-0">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
