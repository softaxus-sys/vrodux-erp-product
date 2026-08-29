import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Building2, MapPin, Calendar, Users, TrendingUp,
  DollarSign, Wrench, BarChart3, Edit, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";
import type { PropertyDto as Property } from "@/lib/real-estate/re.api";

const TYPE_LABELS: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed_use: "Mixed Use",
  industrial: "Industrial",
  retail: "Retail",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "text-success bg-success/10" },
  inactive: { label: "Inactive", className: "text-muted-foreground bg-muted" },
  under_development: { label: "Under Development", className: "text-warning bg-warning/10" },
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
  property: Property | null;
}

export function PropertiesDrawer({ open, onClose, property }: Props) {
  const currency = useCurrency();
  return (
    <AnimatePresence>
      {open && property && (
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
                Property Details
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
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold leading-tight">{property.name}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {property.location.city}, {property.location.emirate}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0",
                        STATUS_CONFIG[property.status].className
                      )}
                    >
                      {STATUS_CONFIG[property.status].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      {property.propertyCode}
                    </span>
                    <span>·</span>
                    <span>{TYPE_LABELS[property.type]}</span>
                    <span>·</span>
                    <span>Built {property.yearBuilt}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Occupancy visual */}
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    Occupancy
                  </h3>
                  <span className="text-lg font-bold text-primary">{property.occupancyRate}%</span>
                </div>
                <div className="h-2.5 bg-border rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${property.occupancyRate}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      property.occupancyRate >= 90
                        ? "bg-success"
                        : property.occupancyRate >= 75
                          ? "bg-warning"
                          : "bg-destructive"
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-bold">{property.totalUnits}</p>
                    <p className="text-[11px] text-muted-foreground">Total Units</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-bold text-success">
                      {property.totalUnits - property.vacantUnits}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Rented</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-bold text-warning">{property.vacantUnits}</p>
                    <p className="text-[11px] text-muted-foreground">Vacant</p>
                  </div>
                </div>
              </div>

              {/* Financials */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Financial Summary
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  <InfoRow
                    icon={DollarSign}
                    label="Total Value"
                    value={
                      <span className="font-bold text-primary">
                        {formatCurrency(property.totalValue, currency)}
                      </span>
                    }
                  />
                  <InfoRow
                    icon={TrendingUp}
                    label="Annual Rent Revenue"
                    value={formatCurrency(property.annualRent, currency)}
                  />
                  <InfoRow
                    icon={BarChart3}
                    label="Avg Rent / Unit"
                    value={formatCurrency(
                      Math.round(property.annualRent / (property.totalUnits - property.vacantUnits)),
                      currency
                    )}
                  />
                  <InfoRow
                    icon={TrendingUp}
                    label="Yield (Gross)"
                    value={`${((property.annualRent / property.totalValue) * 100).toFixed(2)}%`}
                  />
                </div>
              </div>

              {/* Property Details */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Property Information
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-0">
                  <InfoRow icon={MapPin} label="Address" value={property.location.address} />
                  <InfoRow icon={Building2} label="Developer" value={property.developer} />
                  <InfoRow icon={Users} label="Managed By" value={property.managedBy} />
                  <InfoRow icon={Calendar} label="Year Built" value={property.yearBuilt.toString()} />
                </div>
              </div>

              {/* Facilities */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Facilities & Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {property.facilities.map((f) => (
                    <span
                      key={f}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 text-primary text-xs font-medium border border-primary/20"
                    >
                      <Wrench className="h-3 w-3" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-border shrink-0 flex items-center gap-2">
              <Button size="sm" className="flex-1">
                View All Units
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Generate Report
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

