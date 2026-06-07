"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Home, MapPin, User, Calendar, DollarSign,
  Wrench, FileText, AlertTriangle, Edit, Printer, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { UnitDto as Unit, UnitStatus } from "@/lib/real-estate/real-estate.api";

const STATUS_CONFIG: Record<UnitStatus, { label: string; className: string }> = {
  rented: { label: "Rented", className: "text-success bg-success/10" },
  vacant: { label: "Vacant", className: "text-warning bg-warning/10" },
  reserved: { label: "Reserved", className: "text-primary bg-primary/10" },
  maintenance: { label: "Maintenance", className: "text-destructive bg-destructive/10" },
  for_sale: { label: "For Sale", className: "text-blue-600 bg-blue-500/10" },
  sold: { label: "Sold", className: "text-muted-foreground bg-muted" },
};

const TYPE_LABELS: Record<string, string> = {
  apartment: "Apartment",
  villa: "Villa",
  office: "Office",
  retail_shop: "Retail Shop",
  warehouse: "Warehouse",
  studio: "Studio",
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 flex justify-between gap-4">
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
        <span className="text-sm font-medium text-right">{value}</span>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  unit: Unit | null;
}

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
}

export function UnitsDrawer({ open, onClose, unit }: Props) {
  return (
    <AnimatePresence>
      {open && unit && (
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
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Unit Details
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Header */}
            <div className="px-5 py-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Home className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold leading-tight">Unit {unit.unitNumber}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{unit.propertyName}</p>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0",
                        STATUS_CONFIG[unit.status].className
                      )}
                    >
                      {STATUS_CONFIG[unit.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{TYPE_LABELS[unit.type]}</span>
                    <span>·</span>
                    <span>Floor {unit.floor}</span>
                    <span>·</span>
                    <span>{unit.area} sqm</span>
                    {unit.bedrooms !== null && (
                      <>
                        <span>·</span>
                        <span>{unit.bedrooms === 0 ? "Studio" : `${unit.bedrooms}BR`}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Unit details */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Unit Specifications
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  <InfoRow icon={Home} label="Property" value={unit.propertyName} />
                  <InfoRow icon={MapPin} label="Floor" value={`Floor ${unit.floor}`} />
                  <InfoRow icon={Home} label="Area" value={`${unit.area} sqm`} />
                  {unit.bedrooms !== null && (
                    <InfoRow
                      icon={Home}
                      label="Bedrooms"
                      value={unit.bedrooms === 0 ? "Studio" : unit.bedrooms.toString()}
                    />
                  )}
                  <InfoRow icon={Home} label="Bathrooms" value={unit.bathrooms.toString()} />
                </div>
              </div>

              {/* Financial */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Financial Summary
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  <InfoRow
                    icon={DollarSign}
                    label="Annual Rent"
                    value={
                      <span className="font-bold text-primary">
                        {formatCurrency(unit.rentPricePA, "AED")}
                      </span>
                    }
                  />
                  <InfoRow
                    icon={DollarSign}
                    label="Monthly Rent"
                    value={formatCurrency(Math.round(unit.rentPricePA / 12), "AED")}
                  />
                  {unit.salePriceIfForSale && (
                    <InfoRow
                      icon={DollarSign}
                      label="Sale Price"
                      value={
                        <span className="font-bold text-blue-600">
                          {formatCurrency(unit.salePriceIfForSale, "AED")}
                        </span>
                      }
                    />
                  )}
                </div>
              </div>

              {/* Tenant info */}
              {unit.status === "rented" && unit.tenantName && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Current Tenant
                  </h3>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                    <InfoRow icon={User} label="Tenant Name" value={unit.tenantName} />
                    {unit.contractId && (
                      <InfoRow
                        icon={FileText}
                        label="Contract"
                        value={
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            {unit.contractId.toUpperCase()}
                          </span>
                        }
                      />
                    )}
                    {unit.contractExpiry && (
                      <InfoRow
                        icon={Calendar}
                        label="Contract Expiry"
                        value={
                          <span
                            className={cn(
                              "font-semibold",
                              isExpiringSoon(unit.contractExpiry)
                                ? "text-warning"
                                : "text-foreground"
                            )}
                          >
                            {isExpiringSoon(unit.contractExpiry) && (
                              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                            )}
                            {formatDate(unit.contractExpiry, "medium")}
                          </span>
                        }
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Maintenance history */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Maintenance
                </h3>
                <div className="space-y-2">
                  {unit.status === "maintenance" && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                      <Wrench className="h-4 w-4 text-destructive shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-destructive">Under Maintenance</p>
                        <p className="text-xs text-muted-foreground">Unit is currently unavailable.</p>
                      </div>
                    </div>
                  )}
                  {unit.lastMaintenanceDate && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Last Maintenance Completed</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(unit.lastMaintenanceDate, "medium")}
                        </p>
                      </div>
                    </div>
                  )}
                  {[
                    { label: "HVAC Service", date: "2025-09-10", status: "completed" },
                    { label: "Plumbing Inspection", date: "2025-06-20", status: "completed" },
                  ].map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(m.date, "medium")}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full capitalize">
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-border shrink-0 flex items-center gap-2">
              {unit.status === "vacant" || unit.status === "reserved" ? (
                <Button size="sm" className="flex-1">
                  Create Lease
                </Button>
              ) : unit.status === "rented" ? (
                <Button size="sm" className="flex-1">
                  View Contract
                </Button>
              ) : null}
              <Button variant="outline" size="sm" className="flex-1">
                <Wrench className="h-4 w-4 mr-2" /> Raise Work Order
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
